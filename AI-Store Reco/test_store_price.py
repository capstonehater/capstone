import unittest
import io
from unittest.mock import patch, MagicMock
import store_price


class StoreSearchTests(unittest.TestCase):
    def setUp(self):
        market = patch.object(store_price, 'get_general_market_estimate', return_value=None)
        market.start()
        self.addCleanup(market.stop)

    def test_market_reference_is_shared_even_with_confirmed_store_prices(self):
        quote = {'price': 110, 'listings': [
            {'price': 100, 'title': 'Pasta', 'url': 'https://a.example'},
            {'price': 120, 'title': 'Pasta', 'url': 'https://b.example'}]}
        with patch.object(store_price, 'get_general_market_estimate', return_value=quote) as market, patch.object(
            store_price, 'select_market_brand', return_value=None), patch.object(
            store_price, 'search_store_price', side_effect=lambda *args: {'status': 'FOUND', 'price': 90}):
            results = store_price.run_search('Pasta', [{'name': 'A'}, {'name': 'B'}])
        market.assert_called_once_with('Pasta')
        self.assertEqual(results[0]['market_reference'], results[1]['market_reference'])
        self.assertEqual(results[0]['price'], 90)
        self.assertEqual(results[0]['market_reference']['median_php'], 110)
        self.assertEqual(results[0]['market_reference']['sample_size'], 2)

    def test_equivalent_units_match_but_wrong_size_and_multipack_do_not(self):
        self.assertTrue(store_price.product_matches('Pasta 500g', 'Pasta 0.5 kg PHP 100'))
        self.assertFalse(store_price.product_matches('Pasta 500g', 'Pasta 1kg PHP 100'))
        self.assertFalse(store_price.product_matches('Milk 1l', 'Milk 1kg PHP 100'))
        self.assertFalse(store_price.product_matches('Pasta 500g', 'Pasta 6 x 500g PHP 100'))

    def test_classifier_rejects_string_booleans_duplicate_and_missing_indices(self):
        client = MagicMock()
        item = {'title': 'Shop Pasta', 'url': 'https://shop.example',
                'content': 'PHP 100', 'detected_price': 100}
        responses = [
            '[{"index":0,"product_match":"false","store_match":"SAME_STORE"}]',
            '[{"index":true,"product_match":true,"store_match":"SAME_STORE"}]',
            '[{"index":2,"product_match":true,"store_match":"SAME_STORE"}]',
            '[]',
        ]
        with patch.object(store_price, 'client', client):
            for response in responses:
                client.chat.completions.create.return_value.choices[0].message.content = response
                self.assertIsNone(store_price.classify_items_with_llm([item], 'Shop', 'Pasta'))

    def test_wrong_pack_cannot_be_promoted_by_qwen(self):
        with patch.object(store_price, 'classify_items_with_llm') as classifier:
            result = store_price.build_fallback_result([
                {'title': 'Shop Pasta 1kg', 'content': 'PHP 100', 'url': 'https://shop.example'}
            ], 'Shop', 'Pasta 500g')
        self.assertIsNone(result)
        classifier.assert_not_called()

    def test_search_deduplicates_tracking_urls_and_rejects_non_web_sources(self):
        items = store_price.extract_search_items({'organic': [
            {'title': 'Pasta', 'link': 'https://shop.example/pasta?utm_source=a'},
            {'title': 'Pasta', 'link': 'https://shop.example/pasta?utm_source=b'},
            {'title': 'Invalid', 'link': 'javascript:alert(1)'},
        ]})
        self.assertEqual(len(items), 1)

    def test_other_retailer_quote_does_not_stop_supplier_search(self):
        store = {'name': 'Shop', 'formatted_address': 'Cavite', 'latitude': 14,
                 'longitude': 120, 'place_id': ''}
        with patch.object(store_price, 'USE_LLM_CLASSIFIER', False), patch.object(
            store_price, 'search_web', side_effect=[
                [{'title': 'Other Pasta', 'content': 'PHP 50', 'url': 'https://other.example'}],
                [{'title': 'Shop Pasta', 'content': 'PHP 100', 'url': 'https://shop.example'}],
            ]
        ) as search:
            result = store_price.search_store_price('Pasta', store)
        self.assertEqual(search.call_count, 2)
        self.assertEqual(result['price'], 100)
        self.assertEqual(result['price_type'], 'confirmed')

    def test_location_only_results_retry_product_chain_search(self):
        store = {"name": "Shop Cavite", "formatted_address": "Cavite Highway", "latitude": 14,
                 "longitude": 120, "place_id": ""}
        with patch.object(store_price, "USE_LLM_CLASSIFIER", False), patch.object(
            store_price, "search_web", side_effect=[
                [{"title": "Shop directions", "content": "Open 9am", "url": "https://example.com/maps"}],
                [{"title": "Shop Pasta", "content": "PHP 100", "url": "https://example.com/pasta"}],
            ]
        ) as search:
            result = store_price.search_store_price("Pasta", store)
        self.assertEqual(result["price"], 100)
        self.assertEqual(len(result["search_evidence"]), 2)
        self.assertNotIn("Cavite Highway", search.call_args.args[0])

    def test_connection_error_is_saved_without_sensitive_provider_details(self):
        store = {"name": "Shop", "formatted_address": "Cavite", "latitude": 14,
                 "longitude": 120, "place_id": ""}
        with patch.object(store_price, "search_web", side_effect=store_price.requests.ConnectionError("private provider details")):
            result = store_price.search_store_price("Pasta", store)
        self.assertEqual(result["status"], "ERROR")
        self.assertIn("network access", result["search_error"])
        self.assertNotIn("private provider details", str(result))

    def test_collection_stage_never_initializes_qwen(self):
        with patch.object(store_price, "serper_api_key", "test"), patch.object(
            store_price, "api_key", None
        ), patch.object(store_price, "client", None), patch.object(
            store_price, "USE_LLM_CLASSIFIER", True
        ), patch.object(store_price, "Groq") as groq, patch.object(
            store_price, "run_search", return_value=[]
        ), patch.object(store_price.sys, "stdin", io.StringIO(
            '{"product":"Pasta","stores":[],"collect_only":true}'
        )), patch.object(store_price.sys, "stdout", io.StringIO()):
            store_price.main()
            groq.assert_not_called()
            self.assertFalse(store_price.USE_LLM_CLASSIFIER)
            self.assertIsNone(store_price.client)

    def test_availability_needs_explicit_matching_evidence(self):
        def item(title, content):
            return {"title": title, "content": content, "url": "https://example.com"}
        for items, expected in [
            ([item("Shop Pasta", "PHP 100")], "UNKNOWN"),
            ([item("Other Pasta", "In stock")], "UNKNOWN"),
            ([item("Shop Soap", "In stock")], "UNKNOWN"),
            ([item("Shop Pasta", "In stock")], "IN_STOCK"),
            ([item("Shop Pasta", "Not in stock")], "OUT_OF_STOCK"),
            ([item("Shop Pasta", "In stock"), item("Shop Pasta", "Sold out")], "UNKNOWN"),
        ]:
            with self.subTest(items=items):
                self.assertEqual(store_price.extract_availability(items, "Shop", "Pasta")["status"], expected)

    def test_search_keeps_serper_evidence_for_database(self):
        items = [{"title": "Shop Pasta", "content": "PHP 100 In stock", "url": "https://example.com"}]
        store = {"name": "Shop", "formatted_address": "Cavite", "latitude": 14,
                 "longitude": 120, "place_id": ""}
        with patch.object(store_price, "search_web", return_value=items), patch.object(store_price, "USE_LLM_CLASSIFIER", False):
            result = store_price.search_store_price("Pasta", store)
        self.assertEqual(result["search_evidence"], items)
        self.assertEqual(result["availability"]["status"], "IN_STOCK")
        self.assertIn("fetched_at", result)

    def test_distance_uses_configured_origin_in_saved_result(self):
        store = {"name": "Shop", "latitude": store_price.USER_LATITUDE,
                 "longitude": store_price.USER_LONGITUDE}
        with patch.object(store_price, "select_market_brand", return_value=None), patch.object(
            store_price, "search_store_price", return_value={"status": "NOT_FOUND"}
        ):
            result = store_price.run_search("Bacon", [store])[0]
        self.assertEqual(result["distance"], 0)

    def test_distance_handles_known_and_invalid_coordinates(self):
        self.assertAlmostEqual(store_price.calculate_distance(0, 0, 0, 1), 111.195, places=3)
        for lat, lon in [(None, 120), (float("nan"), 120), (14, float("inf")), (91, 120), (14, 181)]:
            self.assertIsNone(store_price.calculate_distance(14, 120, lat, lon))

    def test_one_brand_is_reused_for_all_stores(self):
        stores = [{"name": name, "latitude": None, "longitude": None} for name in ["Shop A", "Shop B"]]
        with patch.object(store_price, "select_market_brand", return_value="Example") as select, patch.object(
            store_price, "search_store_price", side_effect=lambda *args: {"status": "NOT_FOUND"}
        ) as search:
            results = store_price.run_search("Spaghetti Pasta 500g", stores)
        select.assert_called_once_with("Spaghetti Pasta 500g")
        self.assertEqual([call.args[0] for call in search.call_args_list], ["Example Spaghetti Pasta 500g"] * 2)
        self.assertTrue(all(row["selected_brand"] == "Example" for row in results))

    def test_existing_brand_is_not_duplicated(self):
        with patch.object(store_price, "select_market_brand", return_value="Example"), patch.object(
            store_price, "search_store_price", return_value={"status": "NOT_FOUND"}
        ) as search:
            store_price.run_search("Example Pasta", [{"name": "Shop"}])
        self.assertEqual(search.call_args.args[0], "Example Pasta")

    def test_brand_must_appear_in_search_evidence(self):
        client = MagicMock()
        client.chat.completions.create.return_value.choices[0].message.content = '{"brand":"Invented"}'
        with patch.object(store_price, "client", client), patch.object(store_price, "search_web", return_value=[
            {"title": "Example Pasta", "content": "Supermarket pasta", "url": "https://example.com"}
        ]):
            self.assertIsNone(store_price.select_market_brand("Pasta"))

    def test_query_uses_saved_address(self):
        query = store_price.create_store_query("Bacon", {
            "name": "Puregold", "formatted_address": "Aguinaldo Highway, Dasmarinas",
            "latitude": 14.327048, "longitude": 120.939944,
        })
        self.assertIn("Bacon Puregold Aguinaldo Highway, Dasmarinas", query)

    def test_coordinates_are_used_when_address_is_missing(self):
        query = store_price.create_store_query("Bacon", {
            "name": "Shop", "latitude": 14.327048, "longitude": 120.939944,
        })
        self.assertIn("14.327048, 120.939944", query)
        self.assertNotIn("None", query)

    def test_classifier_receives_address_and_coordinates(self):
        store = {"name": "Shop", "formatted_address": "Dasmarinas", "latitude": 14.3,
                 "longitude": 120.9, "place_id": ""}
        with patch.object(store_price, "search_web", return_value=[]), patch.object(
            store_price, "build_fallback_result", return_value=None
        ) as classify:
            store_price.search_store_price("Bacon", store)
        self.assertEqual(classify.call_args.args[3], "Dasmarinas\n14.300000, 120.900000")

    def test_selected_product_and_supplier_reach_existing_search(self):
        store = {"supplier_id": "supplier-1", "name": "Shop", "latitude": None, "longitude": None}
        with patch.object(store_price, "search_store_price", return_value={"status": "FOUND", "raw_response": "private"}) as search:
            result = store_price.run_search("Bacon", [store])
        self.assertEqual(search.call_args.args[:2], ("Bacon", store))
        self.assertEqual(result[0]["supplier_id"], "supplier-1")
        self.assertNotIn("raw_response", result[0])

    def test_fallback_rejects_wrong_product(self):
        with patch.object(store_price, "USE_LLM_CLASSIFIER", False):
            result = store_price.build_fallback_result([
                {"title": "Shop soap", "content": "PHP 100", "url": "https://shop.example"}
            ], "Shop", "Bacon")
        self.assertIsNone(result)

    def test_other_store_price_is_an_estimate(self):
        with patch.object(store_price, "USE_LLM_CLASSIFIER", False):
            result = store_price.build_fallback_result([
                {"title": "Other Bacon", "content": "PHP 100", "url": "https://other.example"}
            ], "Shop", "Bacon")
        self.assertEqual(result["price_type"], "market_estimate")


if __name__ == "__main__":
    unittest.main()
