import os
import csv
import threading
import requests
import customtkinter as ctk
import tkintermapview

from tkinter import messagebox
from dotenv import load_dotenv

from PIL import Image, ImageTk, ImageDraw


# ============================================================
# CONFIGURATION
# ============================================================

load_dotenv()

API_KEY = os.getenv("LOCATIONIQ_API_KEY")

LOCATIONIQ_URL = "https://us1.locationiq.com/v1/search"
REVERSE_URL = "https://us1.locationiq.com/v1/reverse"

CSV_FILE = "locations.csv"

FIELDNAMES = [
    "input_location",
    "name",
    "formatted_address",
    "latitude",
    "longitude",
    "place_id"
]


# ============================================================
# COLORS
# ============================================================

WHITE = "#FFFFFF"
BLACK = "#111111"
DARK_GRAY = "#555555"
LIGHT_GRAY = "#F5F5F5"
BORDER_GRAY = "#E5E5E5"

GREEN = "#00BF63"
GREEN_HOVER = "#00A956"
GREEN_LIGHT = "#E9F8F0"

RED = "#E53935"
RED_HOVER = "#C62828"

BUTTON_GRAY = "#F2F2F2"
BUTTON_GRAY_HOVER = "#E6E6E6"


# ============================================================
# STORE LOCATOR APPLICATION
# ============================================================

class StoreLocatorApp(ctk.CTk):

    def __init__(self):
        super().__init__()

        # ----------------------------------------------------
        # WINDOW
        # ----------------------------------------------------

        self.title("Store Locator")
        self.geometry("1400x820")
        self.minsize(1100, 650)
        self.configure(fg_color=WHITE)

        # ----------------------------------------------------
        # VARIABLES
        # ----------------------------------------------------

        self.locations = []
        self.selected_index = None

        self.clicked_latitude = None
        self.clicked_longitude = None

        self.pending_location = None

        # The reverse-geocoded address for a manually clicked pin,
        # kept SEPARATE from whatever the user types as the store
        # name - these two used to be conflated because the search
        # box was reused for both purposes.
        self.pending_reverse_address = None

        self.saved_markers = []
        self.temporary_marker = None

        # ----------------------------------------------------
        # CUSTOM MAP ICON
        # ----------------------------------------------------

        self.create_pin_icon()

        # ----------------------------------------------------
        # CSV
        # ----------------------------------------------------

        self.initialize_csv()
        self.load_locations()

        # ----------------------------------------------------
        # UI
        # ----------------------------------------------------

        self.create_interface()

        if not API_KEY:
            self.footer_instruction.configure(
                text="⚠ LOCATIONIQ_API_KEY not set - search & reverse geocoding disabled",
                text_color=RED
            )

        # ----------------------------------------------------
        # MAP
        # ----------------------------------------------------

        self.load_map()

        # ----------------------------------------------------
        # EVENTS
        # ----------------------------------------------------

        self.map_widget.add_left_click_map_command(self.map_clicked)
        self.protocol("WM_DELETE_WINDOW", self.quit_application)


    # ========================================================
    # SMALL RED MAP PIN
    # ========================================================

    def create_pin_icon(self):
        width, height = 18, 24

        image = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        draw = ImageDraw.Draw(image)

        draw.polygon(
            [(9, 23), (3, 12), (3, 7), (5, 3), (9, 1), (13, 3), (15, 7), (15, 12)],
            fill=RED
        )

        draw.ellipse((7, 5, 11, 9), fill=WHITE)

        self.pin_icon = ImageTk.PhotoImage(image)


    # ========================================================
    # CSV FUNCTIONS
    # ========================================================

    def initialize_csv(self):
        if not os.path.exists(CSV_FILE):
            with open(CSV_FILE, "w", newline="", encoding="utf-8") as file:
                writer = csv.DictWriter(file, fieldnames=FIELDNAMES)
                writer.writeheader()


    def load_locations(self):
        self.initialize_csv()

        try:
            with open(CSV_FILE, "r", newline="", encoding="utf-8") as file:
                reader = csv.DictReader(file)
                self.locations = list(reader)

        except Exception as error:
            messagebox.showerror("CSV Error", f"Unable to read locations.csv\n\n{error}")
            self.locations = []


    def save_locations(self):
        with open(CSV_FILE, "w", newline="", encoding="utf-8") as file:
            writer = csv.DictWriter(file, fieldnames=FIELDNAMES)
            writer.writeheader()
            writer.writerows(self.locations)


    # ========================================================
    # MAIN UI
    # ========================================================

    def create_interface(self):

        self.grid_columnconfigure(0, weight=0)
        self.grid_columnconfigure(1, weight=1)
        self.grid_rowconfigure(0, weight=1)
        self.grid_rowconfigure(1, weight=0)

        # ----------------------------------------------------
        # LEFT SIDEBAR
        # ----------------------------------------------------

        self.sidebar = ctk.CTkFrame(self, width=440, corner_radius=0, fg_color=WHITE)
        self.sidebar.grid(row=0, column=0, sticky="nsew")
        self.sidebar.grid_propagate(False)

        # ----------------------------------------------------
        # RIGHT MAP AREA
        # ----------------------------------------------------

        self.map_area = ctk.CTkFrame(self, corner_radius=0, fg_color=WHITE)
        self.map_area.grid(row=0, column=1, sticky="nsew", padx=(0, 20), pady=20)
        self.map_area.grid_rowconfigure(0, weight=1)
        self.map_area.grid_columnconfigure(0, weight=1)

        # ====================================================
        # SIDEBAR CONTENT
        # ====================================================

        self.sidebar_content = ctk.CTkFrame(self.sidebar, fg_color="transparent")
        self.sidebar_content.pack(fill="both", expand=True, padx=35, pady=35)

        # ----------------------------------------------------
        # TITLE
        # ----------------------------------------------------

        title = ctk.CTkLabel(
            self.sidebar_content,
            text="Find Store",
            anchor="w",
            font=ctk.CTkFont(family="Arial", size=30, weight="bold"),
            text_color=BLACK
        )
        title.pack(fill="x", pady=(0, 18))

        # ----------------------------------------------------
        # SEARCH
        # ----------------------------------------------------

        search_frame = ctk.CTkFrame(self.sidebar_content, fg_color=WHITE)
        search_frame.pack(fill="x")

        self.search_entry = ctk.CTkEntry(
            search_frame,
            height=54,
            corner_radius=27,
            border_width=1,
            border_color=BLACK,
            fg_color=WHITE,
            text_color=BLACK,
            placeholder_text="Search store or location...",
            placeholder_text_color="#888888",
            font=ctk.CTkFont(size=14)
        )
        self.search_entry.pack(fill="x")
        self.search_entry.bind("<Return>", lambda event: self.search_location())

        self.search_button = ctk.CTkButton(
            search_frame,
            text="⌕",
            width=46,
            height=46,
            corner_radius=23,
            fg_color=WHITE,
            hover_color=WHITE,
            text_color=BLACK,
            font=ctk.CTkFont(size=25),
            command=self.search_location
        )
        self.search_button.place(relx=1.0, rely=0.5, x=-4, anchor="e")

        # ----------------------------------------------------
        # STORE NAME (used when manually placing a pin)
        # ----------------------------------------------------
        #
        # Kept separate from the search box above so that a
        # reverse-geocoded address (shown after clicking the map)
        # never silently becomes the store's saved "name".

        self.store_name_entry = ctk.CTkEntry(
            self.sidebar_content,
            height=44,
            corner_radius=22,
            border_width=1,
            border_color=BORDER_GRAY,
            fg_color=WHITE,
            text_color=BLACK,
            placeholder_text="Store name (used when pinning manually)",
            placeholder_text_color="#888888",
            font=ctk.CTkFont(size=13)
        )
        self.store_name_entry.pack(fill="x", pady=(10, 0))

        # ----------------------------------------------------
        # ADD BUTTON
        # ----------------------------------------------------

        self.add_button = ctk.CTkButton(
            self.sidebar_content,
            text="Add",
            width=140,
            height=43,
            corner_radius=22,
            fg_color=GREEN,
            hover_color=GREEN_HOVER,
            text_color=WHITE,
            font=ctk.CTkFont(size=15, weight="bold"),
            command=self.add_location
        )
        self.add_button.pack(anchor="e", pady=(12, 20))

        # ----------------------------------------------------
        # LOCATION INFORMATION
        # ----------------------------------------------------

        self.location_info = ctk.CTkFrame(
            self.sidebar_content,
            height=150,
            corner_radius=10,
            fg_color=WHITE,
            border_width=1,
            border_color=BORDER_GRAY
        )
        self.location_info.pack(fill="x", pady=(0, 24))
        self.location_info.pack_propagate(False)

        self.selected_label = ctk.CTkLabel(
            self.location_info,
            text="⌖  No location selected",
            anchor="w",
            font=ctk.CTkFont(size=15, weight="bold"),
            text_color=BLACK
        )
        self.selected_label.pack(fill="x", padx=16, pady=(14, 3))

        self.instruction_label = ctk.CTkLabel(
            self.location_info,
            text="Click the map to place a pin",
            anchor="w",
            font=ctk.CTkFont(size=13),
            text_color=DARK_GRAY
        )
        self.instruction_label.pack(fill="x", padx=16)

        divider = ctk.CTkFrame(self.location_info, height=1, fg_color=BORDER_GRAY)
        divider.pack(fill="x", padx=16, pady=12)

        self.coordinate_label = ctk.CTkLabel(
            self.location_info,
            text="Latitude: -\nLongitude: -",
            anchor="w",
            justify="left",
            font=ctk.CTkFont(size=12),
            text_color=DARK_GRAY
        )
        self.coordinate_label.pack(fill="x", padx=16)

        # ----------------------------------------------------
        # SAVED STORES TITLE
        # ----------------------------------------------------

        saved_title = ctk.CTkLabel(
            self.sidebar_content,
            text="Saved Stores",
            anchor="w",
            font=ctk.CTkFont(size=20, weight="bold"),
            text_color=BLACK
        )
        saved_title.pack(fill="x", pady=(0, 8))

        # ----------------------------------------------------
        # SCROLLABLE STORE LIST
        # ----------------------------------------------------

        self.store_list = ctk.CTkScrollableFrame(
            self.sidebar_content,
            corner_radius=0,
            fg_color=WHITE,
            scrollbar_button_color="#D5D5D5",
            scrollbar_button_hover_color="#BBBBBB"
        )
        self.store_list.pack(fill="both", expand=True)

        # ----------------------------------------------------
        # BUTTON ROW
        # ----------------------------------------------------

        button_frame = ctk.CTkFrame(self.sidebar_content, fg_color="transparent")
        button_frame.pack(fill="x", pady=(15, 0))

        self.delete_button = ctk.CTkButton(
            button_frame,
            text="🗑  Delete",
            height=42,
            corner_radius=9,
            fg_color=WHITE,
            hover_color="#FFF1F1",
            border_width=1,
            border_color=RED,
            text_color=RED,
            command=self.delete_selected
        )
        self.delete_button.pack(side="left", expand=True, fill="x", padx=(0, 5))

        self.refresh_button = ctk.CTkButton(
            button_frame,
            text="⟳  Refresh",
            height=42,
            corner_radius=9,
            fg_color=WHITE,
            hover_color=BUTTON_GRAY_HOVER,
            border_width=1,
            border_color=BORDER_GRAY,
            text_color=BLACK,
            command=self.refresh_all
        )
        self.refresh_button.pack(side="left", expand=True, fill="x", padx=5)

        self.quit_button = ctk.CTkButton(
            button_frame,
            text="⏻  Quit",
            height=42,
            corner_radius=9,
            fg_color="#444444",
            hover_color="#222222",
            text_color=WHITE,
            command=self.quit_application
        )
        self.quit_button.pack(side="left", expand=True, fill="x", padx=(5, 0))

        # ====================================================
        # MAP
        # ====================================================

        self.map_widget = tkintermapview.TkinterMapView(self.map_area, corner_radius=10)
        self.map_widget.grid(row=0, column=0, sticky="nsew")

        # ====================================================
        # FOOTER
        # ====================================================

        self.footer = ctk.CTkFrame(
            self, height=55, corner_radius=0, fg_color=WHITE,
            border_width=1, border_color=BORDER_GRAY
        )
        self.footer.grid(row=1, column=0, columnspan=2, sticky="ew")
        self.footer.grid_columnconfigure(1, weight=1)

        self.total_label = ctk.CTkLabel(
            self.footer, text="📍  Total Stores: 0",
            text_color=DARK_GRAY, font=ctk.CTkFont(size=13)
        )
        self.total_label.grid(row=0, column=0, padx=25, pady=14, sticky="w")

        self.footer_instruction = ctk.CTkLabel(
            self.footer, text="Click on the map to select a location",
            text_color=DARK_GRAY, font=ctk.CTkFont(size=13)
        )
        self.footer_instruction.grid(row=0, column=1)

        self.file_label = ctk.CTkLabel(
            self.footer, text="Data saved in:  locations.csv",
            text_color=DARK_GRAY, font=ctk.CTkFont(size=13)
        )
        self.file_label.grid(row=0, column=2, padx=25, sticky="e")


    # ========================================================
    # MAP INITIALIZATION
    # ========================================================

    def load_map(self):
        # Dasmarinas area
        self.map_widget.set_position(14.2990, 120.9580)
        self.map_widget.set_zoom(13)
        self.rebuild_markers()


    # ========================================================
    # MAP MARKERS
    # ========================================================

    def rebuild_markers(self):
        for marker in self.saved_markers:
            try:
                marker.delete()
            except Exception:
                pass

        self.saved_markers.clear()

        for index, location in enumerate(self.locations):
            try:
                latitude = float(location["latitude"])
                longitude = float(location["longitude"])
            except (ValueError, TypeError):
                continue

            marker = self.map_widget.set_marker(
                latitude, longitude, text="",
                icon=self.pin_icon, icon_anchor="s",
                command=lambda marker, i=index: self.marker_clicked(i)
            )

            marker.data = index
            self.saved_markers.append(marker)


    def marker_clicked(self, index):
        self.select_store(index)


    # ========================================================
    # MAP CLICK
    # ========================================================

    def map_clicked(self, coordinates):
        latitude, longitude = coordinates

        self.clicked_latitude = latitude
        self.clicked_longitude = longitude
        self.pending_location = None
        self.pending_reverse_address = None

        if self.temporary_marker:
            try:
                self.temporary_marker.delete()
            except Exception:
                pass

        self.temporary_marker = self.map_widget.set_marker(
            latitude, longitude, text="", icon=self.pin_icon, icon_anchor="s"
        )

        self.selected_index = None

        self.selected_label.configure(text="⌖  New location selected")
        self.instruction_label.configure(text="Looking up address..." if API_KEY else "Type a store name and press Add")
        self.coordinate_label.configure(
            text=f"Latitude: {latitude:.6f}\nLongitude: {longitude:.6f}"
        )

        # Clear the store-name box so it's ready for a fresh entry -
        # this used to be the search box, which meant a leftover
        # search query could silently become the new store's name.
        self.store_name_entry.delete(0, "end")

        self.reverse_geocode(latitude, longitude)


    # ========================================================
    # REVERSE GEOCODING (runs in a background thread so the map
    # doesn't freeze while waiting on the network)
    # ========================================================

    def reverse_geocode(self, latitude, longitude):
        if not API_KEY:
            return

        def worker():
            params = {"lat": latitude, "lon": longitude, "format": "json", "key": API_KEY}

            try:
                response = requests.get(REVERSE_URL, params=params, timeout=10)
                response.raise_for_status()
                data = response.json()
                address = data.get("display_name", "")

            except requests.RequestException:
                address = ""

            # Hand the result back to the main thread. Only apply it
            # if the user hasn't since clicked somewhere else.
            self.after(0, lambda: self._apply_reverse_geocode_result(
                latitude, longitude, address
            ))

        threading.Thread(target=worker, daemon=True).start()


    def _apply_reverse_geocode_result(self, latitude, longitude, address):
        # Ignore stale results from a previous click.
        if (self.clicked_latitude, self.clicked_longitude) != (latitude, longitude):
            return

        if address:
            self.pending_reverse_address = address
            self.instruction_label.configure(text=address)
        else:
            self.instruction_label.configure(text="Type a store name and press Add")


    # ========================================================
    # SEARCH LOCATION (runs in a background thread)
    # ========================================================

    def search_location(self):
        query = self.search_entry.get().strip()

        if not query:
            messagebox.showwarning("Search", "Please enter a store or location.")
            return

        if not API_KEY:
            messagebox.showerror("API Key Missing", "LOCATIONIQ_API_KEY was not found in .env")
            return

        self.search_button.configure(state="disabled", text="...")

        def worker():
            params = {
                "q": query,
                "countrycodes": "ph",
                "limit": 1,
                "format": "json",
                "key": API_KEY
            }

            try:
                response = requests.get(LOCATIONIQ_URL, params=params, timeout=10)
                if response.status_code == 404:
                    results = []
                else:
                    response.raise_for_status()
                    results = response.json()
                self.after(0, lambda: self._apply_search_result(query, results, None))

            except requests.RequestException as error:
                self.after(0, lambda error=error: self._apply_search_result(query, [], error))

        threading.Thread(target=worker, daemon=True).start()


    def _apply_search_result(self, query, results, error):
        self.search_button.configure(state="normal", text="⌕")

        if error is not None:
            status = getattr(getattr(error, "response", None), "status_code", None)
            detail = f"HTTP {status}" if status else "Check your connection and try again."
            messagebox.showerror("LocationIQ Error", f"LocationIQ request failed.\n\n{detail}")
            return

        if not results:
            messagebox.showinfo("Location Not Found", f"No location was found for:\n\n{query}")
            return

        result = results[0]

        latitude = float(result["lat"])
        longitude = float(result["lon"])
        name = result.get("name") or query
        address = result.get("display_name") or query

        self.map_widget.set_position(latitude, longitude)
        self.map_widget.set_zoom(17)

        if self.temporary_marker:
            try:
                self.temporary_marker.delete()
            except Exception:
                pass

        self.temporary_marker = self.map_widget.set_marker(
            latitude, longitude, text="", icon=self.pin_icon, icon_anchor="s"
        )

        self.clicked_latitude = latitude
        self.clicked_longitude = longitude
        self.selected_index = None

        self.selected_label.configure(text=f"⌖  {name}")
        self.instruction_label.configure(text=address)
        self.coordinate_label.configure(
            text=f"Latitude: {latitude:.6f}\nLongitude: {longitude:.6f}"
        )

        self.pending_location = {
            "input_location": query,
            "name": name,
            "formatted_address": address,
            "latitude": latitude,
            "longitude": longitude,
            "place_id": result.get("place_id", "")
        }


    # ========================================================
    # ADD LOCATION
    # ========================================================

    def add_location(self):

        # ----------------------------------------------------
        # SEARCH RESULT
        # ----------------------------------------------------

        if self.pending_location:
            location = self.pending_location.copy()

        # ----------------------------------------------------
        # MANUALLY PINNED LOCATION
        # ----------------------------------------------------

        elif self.clicked_latitude is not None and self.clicked_longitude is not None:
            store_name = self.store_name_entry.get().strip()

            if not store_name:
                messagebox.showwarning(
                    "Store Name",
                    "Enter the store name in the \"Store name\" box before pressing Add."
                )
                return

            # Use the actual reverse-geocoded address when available,
            # rather than reusing the store name as a stand-in address.
            location = {
                "input_location": store_name,
                "name": store_name,
                "formatted_address": self.pending_reverse_address or store_name,
                "latitude": self.clicked_latitude,
                "longitude": self.clicked_longitude,
                "place_id": ""
            }

        else:
            messagebox.showwarning(
                "No Location",
                "Search for a location or click the map to place a pin first."
            )
            return

        # ----------------------------------------------------
        # DUPLICATE CHECK
        # ----------------------------------------------------

        for existing in self.locations:
            try:
                same_coordinates = (
                    abs(float(existing["latitude"]) - float(location["latitude"])) < 0.000001
                    and
                    abs(float(existing["longitude"]) - float(location["longitude"])) < 0.000001
                )
            except (ValueError, TypeError):
                same_coordinates = False

            same_name = (
                (existing.get("name") or "").strip().lower()
                ==
                (location.get("name") or "").strip().lower()
            )

            if same_name or same_coordinates:
                messagebox.showwarning("Already Saved", "This store/location is already in the CSV.")
                return

        # ----------------------------------------------------
        # SAVE
        # ----------------------------------------------------

        self.locations.append(location)
        self.save_locations()

        # ----------------------------------------------------
        # RESET
        # ----------------------------------------------------

        new_index = len(self.locations) - 1

        self.pending_location = None
        self.pending_reverse_address = None

        if self.temporary_marker:
            try:
                self.temporary_marker.delete()
            except Exception:
                pass
            self.temporary_marker = None

        self.store_name_entry.delete(0, "end")

        self.refresh_store_list()
        self.rebuild_markers()
        self.update_total_count()
        self.select_store(new_index)


    # ========================================================
    # STORE LIST
    # ========================================================

    def refresh_store_list(self):
        for widget in self.store_list.winfo_children():
            widget.destroy()

        if not self.locations:
            label = ctk.CTkLabel(
                self.store_list, text="No stores saved yet.",
                text_color="#999999", font=ctk.CTkFont(size=13)
            )
            label.pack(pady=30)
            self.update_total_count()
            return

        for index, location in enumerate(self.locations):
            self.create_store_card(index, location)

        self.update_total_count()


    def create_store_card(self, index, location):
        is_selected = index == self.selected_index
        frame_color = GREEN_LIGHT if is_selected else WHITE

        frame = ctk.CTkFrame(
            self.store_list, height=80, corner_radius=0,
            fg_color=frame_color, border_width=1, border_color=BORDER_GRAY
        )
        frame.pack(fill="x", pady=0)
        frame.pack_propagate(False)

        name = location["name"]
        address = location["formatted_address"]

        if len(address) > 43:
            address = address[:43] + "..."

        button = ctk.CTkButton(
            frame,
            text=f"{index + 1}. {name}\n    {address}",
            anchor="w",
            fg_color="transparent",
            hover_color=GREEN_LIGHT,
            text_color=BLACK,
            font=ctk.CTkFont(size=13),
            command=lambda i=index: self.select_store(i)
        )
        button.pack(fill="both", expand=True, padx=8, pady=5)


    # ========================================================
    # SELECT SAVED STORE
    # ========================================================

    def select_store(self, index):
        if index < 0 or index >= len(self.locations):
            return

        self.selected_index = index
        location = self.locations[index]

        try:
            latitude = float(location["latitude"])
            longitude = float(location["longitude"])
        except (ValueError, TypeError):
            return

        self.map_widget.set_position(latitude, longitude)
        self.map_widget.set_zoom(17)

        self.selected_label.configure(text=f"⌖  {index + 1}. {location['name']}")
        self.instruction_label.configure(text=location["formatted_address"])
        self.coordinate_label.configure(
            text=f"Latitude: {latitude:.6f}\nLongitude: {longitude:.6f}"
        )

        # Search box stays free for actual searching; the store-name
        # box reflects what's currently selected for editing/reference.
        self.store_name_entry.delete(0, "end")
        self.store_name_entry.insert(0, location["name"])

        self.refresh_store_list()


    # ========================================================
    # DELETE SELECTED
    # ========================================================

    def delete_selected(self):
        if self.selected_index is None:
            messagebox.showwarning("Delete Store", "Please select a store first.")
            return

        location = self.locations[self.selected_index]

        confirmation = messagebox.askyesno(
            "Delete Store", f"Delete this store?\n\n{location['name']}"
        )

        if not confirmation:
            return

        del self.locations[self.selected_index]
        self.save_locations()

        self.selected_index = None
        self.pending_location = None
        self.pending_reverse_address = None
        self.clicked_latitude = None
        self.clicked_longitude = None

        if self.temporary_marker:
            try:
                self.temporary_marker.delete()
            except Exception:
                pass
            self.temporary_marker = None

        self.store_name_entry.delete(0, "end")

        self.selected_label.configure(text="⌖  No location selected")
        self.instruction_label.configure(text="Click the map to place a pin")
        self.coordinate_label.configure(text="Latitude: -\nLongitude: -")

        self.refresh_store_list()
        self.rebuild_markers()


    # ========================================================
    # REFRESH
    # ========================================================

    def refresh_all(self):
        self.load_locations()

        self.selected_index = None
        self.pending_location = None
        self.pending_reverse_address = None
        self.clicked_latitude = None
        self.clicked_longitude = None

        if self.temporary_marker:
            try:
                self.temporary_marker.delete()
            except Exception:
                pass
            self.temporary_marker = None

        self.search_entry.delete(0, "end")
        self.store_name_entry.delete(0, "end")

        self.selected_label.configure(text="⌖  No location selected")
        self.instruction_label.configure(text="Click the map to place a pin")
        self.coordinate_label.configure(text="Latitude: -\nLongitude: -")

        self.refresh_store_list()
        self.rebuild_markers()


    # ========================================================
    # TOTAL STORE COUNT
    # ========================================================

    def update_total_count(self):
        self.total_label.configure(text=f"📍  Total Stores: {len(self.locations)}")


    # ========================================================
    # QUIT
    # ========================================================

    def quit_application(self):
        confirmation = messagebox.askyesno("Quit", "Are you sure you want to close Store Locator?")

        if confirmation:
            self.destroy()


# ============================================================
# START APPLICATION
# ============================================================

if __name__ == "__main__":
    ctk.set_appearance_mode("light")
    ctk.set_default_color_theme("green")

    app = StoreLocatorApp()
    app.mainloop()