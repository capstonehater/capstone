import json
import unittest
from unittest.mock import MagicMock, patch

import store_price
import store_recommendation as reco


def store(name, offset=0, price=100, confirmed=True):
    return {"store_name": name, "latitude": store_price.USER_LATITUDE + offset,
            "longitude": store_price.USER_LONGITUDE, "price": price,
            "price_type": "confirmed" if confirmed else "market_estimate",
            "store_match": "VERIFIED" if confirmed else "UNVERIFIED",
            "status": "FOUND" if confirmed else "UNVERIFIED",
            "source_url": "https://example.com/price"}


class RecommendationTests(unittest.TestCase):
    def test_nearest_estimate_cannot_take_first_place(self):
        rows = reco.rank_stores([store("Nearby", price=50, confirmed=False), store("Confirmed", .02)])
        self.assertEqual([(r["rank"], r["store_name"]) for r in rows["recommendations"]],
                         [(1, "Confirmed"), (2, "Nearby")])

    def test_no_confirmed_leaves_rank_one_empty_and_caps_at_five(self):
        result = reco.rank_stores([store(str(i), i / 100, confirmed=False) for i in range(8)])
        self.assertFalse(result["top_1_available"])
        self.assertEqual([r["rank"] for r in result["recommendations"]], [2, 3, 4, 5])

    def test_distance_and_affordability_both_matter(self):
        result = reco.rank_stores([store("Expensive", .01, 200), store("Cheap", .01, 100)])
        self.assertEqual(result["recommendations"][0]["store_name"], "Cheap")
        result = reco.rank_stores([store("Far", .1), store("Near", .01)])
        self.assertEqual(result["recommendations"][0]["store_name"], "Near")

    def test_origin_recomputed_and_input_not_modified(self):
        row = store("Here")
        row["distance"] = 999
        result = reco.rank_stores([row])["recommendations"][0]
        self.assertEqual(result["distance_km"], 0)
        self.assertEqual(row["distance"], 999)

    def test_invalid_coordinates_or_prices_cannot_win(self):
        for field, value in [("latitude", 91), ("longitude", float("nan")),
                             ("price", -1), ("price", float("inf")), ("source_url", None)]:
            with self.subTest(field=field, value=value):
                row = store("Invalid")
                row[field] = value
                result = reco.rank_stores([row])
                self.assertFalse(result["top_1_available"])
                json.dumps(result, allow_nan=False)

    def test_empty_and_duplicate_inputs(self):
        self.assertEqual(reco.rank_stores([])["recommendations"], [])
        self.assertEqual(len(reco.rank_stores([store("Same"), store("Same")])["recommendations"]), 1)

    def test_qwen_uses_shared_model_and_cannot_change_prices(self):
        client = MagicMock()
        client.chat.completions.create.return_value.choices[0].message.content = json.dumps({
            "recommendations": [{"rank": 1, "candidate_id": 0, "reason": "Confirm stock before travel.", "price_php": 1}]})
        result = reco.recommend_stores("Pasta 500g", [store("Shop")], client)
        self.assertEqual(client.chat.completions.create.call_args.kwargs["model"], store_price.CLASSIFIER_MODEL)
        self.assertEqual(result["recommendations"][0]["price_php"], 100)
        self.assertEqual(result["explanation_source"], store_price.CLASSIFIER_MODEL)

    def test_qwen_can_choose_a_different_eligible_store(self):
        client = MagicMock()
        client.chat.completions.create.return_value.choices[0].message.content = json.dumps({
            "recommendations": [{"rank": 1, "candidate_id": 1, "reason": "Better matching pack."},
                                {"rank": 2, "candidate_id": 0, "reason": "Nearby alternative."}]})
        result = reco.recommend_stores("Pasta", [store("Near"), store("Far", .02)], client)
        self.assertEqual(result["recommendations"][0]["store_name"], "Far")
        self.assertEqual(result["explanation_source"], store_price.CLASSIFIER_MODEL)

    def test_qwen_cannot_promote_unconfirmed_or_invent_store(self):
        for first_id in [0, 99]:
            client = MagicMock()
            client.chat.completions.create.return_value.choices[0].message.content = json.dumps({
                "recommendations": [{"rank": 1, "candidate_id": first_id, "reason": "Bad choice"},
                                    {"rank": 2, "candidate_id": 1, "reason": "Other"}]})
            result = reco.recommend_stores("Pasta", [store("Estimate", confirmed=False), store("Confirmed", .02)], client)
            self.assertEqual(result["recommendations"][0]["store_name"], "Confirmed")
            self.assertEqual(result["explanation_source"], "rules")

    def test_out_of_stock_not_recommended(self):
        row = store("Sold out")
        row["availability"] = {"status": "OUT_OF_STOCK"}
        self.assertEqual(reco.rank_stores([row])["recommendations"], [])

    def test_saved_evidence_is_used_without_new_search(self):
        row = store("Shop")
        row["search_evidence"] = [{"title": "Shop Pasta", "content": "PHP 100", "url": "https://example.com"}]
        with patch.object(store_price, "search_web", side_effect=AssertionError("Must not search")), patch.object(
            store_price, "build_fallback_result", return_value=None
        ) as classify:
            result = reco.recommend_saved_results("Pasta", [row])
        classify.assert_called_once()
        self.assertEqual(classify.call_args.args[0], row["search_evidence"])
        self.assertIsNone(result["results"][0]["price"])
        self.assertEqual(result["results"][0]["recommendation"]["rank"], 2)

    def test_general_market_evidence_survives_review_of_empty_branch_results(self):
        row = store("Shop", confirmed=False)
        row["search_evidence"] = []
        row["market_evidence"] = [{"title": "Other Pasta", "content": "PHP 100", "url": "https://example.com"}]
        fallback = {"price": 100, "price_type": "market_estimate", "store_match": "UNVERIFIED",
                    "source_url": "https://example.com", "note": "Market estimate"}
        with patch.object(store_price, "search_web", side_effect=AssertionError("Must not search")), patch.object(
            store_price, "build_fallback_result", side_effect=[None, fallback]
        ):
            result = reco.recommend_saved_results("Pasta", [row])["results"][0]
        self.assertEqual(result["price"], 100)
        self.assertEqual(result["price_type"], "market_estimate")
        self.assertEqual(result["recommendation"]["rank"], 2)

    def test_bad_or_failed_qwen_response_falls_back(self):
        for response in ['invalid', '{"recommendations":[{"rank":2,"reason":"Wrong"}]}']:
            client = MagicMock()
            client.chat.completions.create.return_value.choices[0].message.content = response
            result = reco.recommend_stores("Pasta", [store("Shop")], client)
            self.assertEqual(result["explanation_source"], "rules")
        client.chat.completions.create.side_effect = RuntimeError("offline")
        self.assertEqual(reco.recommend_stores("Pasta", [store("Shop")], client)["explanation_source"], "rules")

    def test_invalid_weight_rejected(self):
        for weight in [-1, 2, None, True, float("nan")]:
            with self.assertRaises(ValueError):
                reco.rank_stores([], weight)


if __name__ == "__main__":
    unittest.main()
