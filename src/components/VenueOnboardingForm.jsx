// src/pages/VenueOnboardingForm.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import "../vf-onboarding.css";
import { supabase } from "../supabaseClient";
import "sweetalert2/dist/sweetalert2.min.css";
import { useNavigate } from "react-router-dom";
// 🔹 Import your JSX pages/components
import Terms from "../pages/Terms";
import Privacy from "../pages/Privacy";

/* =========================
   Fixed platform policy
========================= */
const RESERVATION_FEE_PERCENT = 10;
const COMMISSION_PERCENT = 5;

/* =========================
   Default form state
========================= */
const defaultVenue = {
  // Basics
  name: "",
  type: "Function Hall",
  description: "",
  video: "",

  // Pricing
  rate_mode: "single",
  rate: "",
  rate_weekday: "",
  rate_weekend: "",

  // Event hours & buffers
  included_event_hours: 4,
  setup_time_mins: 120,
  cleanup_time_mins: 60,
  overtime_rate: "",
  early_loadin_allowed: false,
  early_loadin_fee: "",
  nextday_pickup_allowed: false,
  nextday_pickup_fee: "",

  // Operations
  days: [],
  open_time: "08:00",
  close_time: "22:00",
  hours: "",
  notice: 3,
  capacity_max: "",

  // Contact
  contact_person: "",
  contact_role: "Owner",
  contact_number: "",
  contact_email: "",
  social: "",

  // 🔹 New payout fields
  payout_method: "gcash", // "gcash" | "bank"
  payout_gcash: "",
  payout_bank_name: "",
  payout_bank_account_name: "",
  payout_bank_account_number: "",

  // Multi-selects
  inclusions: [],
  addons: [],
  event_types: [],
  amenities: [],
  rules: [],

  // Legacy fields (kept for compatibility / display)
  address: "",
  coordinates: "",
  location: "",

  // Structured address + geo (text)
  street_line1: "",
  barangay: "",
  city: "",
  province: "",
  region: "",
  postal_code: "",
  country: "PH",
  lat: "",
  lng: "",
  place_id: "",
  formatted_address: "",

  // ⬇️ New canonical IDs
  region_id: "",
  province_id: "",
  city_id: "",
};

const inclusionOptions = [
  "Tables and Chairs",
  "Basic Sound System",
  "Basic Lighting",
  "Air-conditioning",
  "Free Parking",
  "Dressing Room / Bridal Suite",
  "Use of Kitchen / Pantry",
  "Projector / Screen",
  "Venue Staff / Coordinator",
  "Basic Decoration Setup",
  "Cleaning Service",
  "Electricity & Water",
  "Event Signage / Standees",
  "Security / Guard on Duty",
  "Use of Stage / Platform",
  "Restroom Access",
];
const addonOptions = [
  "Corkage Fee (Food)",
  "Corkage Fee (Drinks)",
  "Overtime Charge",
  "Additional Tables/Chairs",
  "Advanced Sound/Lighting",
  "LED Wall Rental",
  "Projector / Screen",
  "On-site Catering",
  "Mobile Bar",
  "Photobooth Setup",
  "Special Cleaning Fee",
];
const eventTypeOptions = [
  "Wedding",
  "Birthday",
  "Debut",
  "Anniversary",
  "Corporate Event",
  "Seminar / Workshop",
  "Product Launch",
  "Photoshoot / Filming",
  "Kids Party",
  "Others",
];
const amenityOptions = [
  "Air-conditioning",
  "WiFi",
  "Parking",
  "Sound System",
  "Projector / LED Wall",
  "Kitchen / Bar",
  "Pool / Outdoor Area",
  "Backup Generator",
];
const ruleOptions = [
  "Alcohol allowed",
  "Smoking allowed",
  "Outside food allowed",
  "Pets allowed",
  "Clean-up required",
  "Cut-off time policy",
  "Noise restrictions apply",
  "Cancellation policy applies",
];

// Accent for the wizard UI (Canva-like purple)
const ACCENT = "#635bff";

/* =========================
   Component
========================= */
export default function VenueOnboardingForm({ venueId, onSaved }) {
  const [authUser, setAuthUser] = useState(null);
  const [form, setForm] = useState(defaultVenue);
  const [loading, setLoading] = useState(false);

  const [showExample, setShowExample] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  // Wizard
  const [step, setStep] = useState(0);
  const STEPS = [
    "Photos & Basics",
    "Pricing & Schedule",
    "Hours & Buffers",
    "Location",
    "Features",
    "Contact & Verification",
  ];

  // Gallery (venue photos)
  const [files, setFiles] = useState([]);
  const [existingImages, setExistingImages] = useState([]);
  const dropRef = useRef(null);

  // Business docs (proof of legit business)
  const [businessDocs, setBusinessDocs] = useState([]);
  const [existingBusinessDocs, setExistingBusinessDocs] = useState([]);

  // Location dropdown data
  const [regions, setRegions] = useState([]);
  const [regionsLoading, setRegionsLoading] = useState(false);
  const [provinces, setProvinces] = useState([]);
  const [provincesLoading, setProvincesLoading] = useState(false);
  const [cities, setCities] = useState([]);
  const [citiesLoading, setCitiesLoading] = useState(false);

  // Map focus (center/zoom) for LocationPickerOSM
  const [mapFocus, setMapFocus] = useState(null); // { lat, lng, zoom }

  const navigate = useNavigate?.();

  /* Auth */
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (data?.user) setAuthUser(data.user);
    })();
  }, []);

  /* Load regions (once) */
  useEffect(() => {
    let alive = true;
    (async () => {
      setRegionsLoading(true);
      const { data, error } = await supabase
        .from("ph_regions")
        .select("id,name,short_name")
        .order("name", { ascending: true });
      if (!alive) return;
      if (error) console.error(error);
      setRegions(data || []);
      setRegionsLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  /* Provinces when region changes */
  useEffect(() => {
    let alive = true;
    const region_id = form.region_id;
    if (!region_id) {
      setProvinces([]);
      setCities([]);
      setForm((f) => ({ ...f, province_id: "", city_id: "" }));
      return;
    }
    (async () => {
      setProvincesLoading(true);
      const { data, error } = await supabase
        .from("ph_provinces")
        .select("id,name,region_id")
        .eq("region_id", region_id)
        .order("name", { ascending: true });
      if (!alive) return;
      if (error) console.error(error);
      setProvinces(data || []);
      setProvincesLoading(false);
      setForm((f) => ({
        ...f,
        province_id: data?.some((d) => d.id === f.province_id)
          ? f.province_id
          : "",
        city_id: "",
      }));
      setCities([]);
    })();
    return () => {
      alive = false;
    };
  }, [form.region_id]);

  /* Cities when province changes */
  useEffect(() => {
    let alive = true;
    const province_id = form.province_id;
    if (!province_id) {
      setCities([]);
      setForm((f) => ({ ...f, city_id: "" }));
      return;
    }
    (async () => {
      setCitiesLoading(true);
      const { data, error } = await supabase
        .from("ph_cities_muns")
        .select("id,name,kind,province_id")
        .eq("province_id", province_id)
        .order("name", { ascending: true });
      if (!alive) return;
      if (error) console.error(error);
      setCities(data || []);
      setCitiesLoading(false);
      setForm((f) => ({
        ...f,
        city_id: data?.some((d) => d.id === f.city_id) ? f.city_id : "",
      }));
    })();
    return () => {
      alive = false;
    };
  }, [form.province_id]);

  /* Edit mode: prefill */
  useEffect(() => {
    if (!venueId) return;
    (async () => {
      const { data: venue, error } = await supabase
        .from("theVenues")
        .select("*")
        .eq("id", venueId)
        .single();

      if (error) {
        console.error(error);
        return;
      }

      // lat/lng fallback
      let lat = venue?.lat ?? "";
      let lng = venue?.lng ?? "";
      if ((!lat || !lng) && typeof venue?.coordinates === "string") {
        const parts = venue.coordinates.split(",").map((s) => s.trim());
        if (parts.length === 2) {
          const [a, b] = parts;
          if (!isNaN(parseFloat(a))) lat = parseFloat(a);
          if (!isNaN(parseFloat(b))) lng = parseFloat(b);
        }
      }

      // Try to map name strings -> IDs if IDs not present yet
      let region_id = venue.region_id || "";
      let province_id = venue.province_id || "";
      let city_id = venue.city_id || "";

      try {
        if (!region_id && venue.region) {
          const { data: r } = await supabase
            .from("ph_regions")
            .select("id")
            .or(`name.ilike.${venue.region},short_name.ilike.${venue.region}`)
            .limit(1)
            .maybeSingle();
          region_id = r?.id || "";
        }
        if (!province_id && (venue.province || venue.state) && region_id) {
          const { data: p } = await supabase
            .from("ph_provinces")
            .select("id")
            .eq("region_id", region_id)
            .ilike("name", venue.province || venue.state)
            .limit(1)
            .maybeSingle();
          province_id = p?.id || "";
        }
        if (!city_id && (venue.city || venue.municipality) && province_id) {
          const { data: c } = await supabase
            .from("ph_cities_muns")
            .select("id")
            .eq("province_id", province_id)
            .ilike("name", venue.city || venue.municipality)
            .limit(1)
            .maybeSingle();
          city_id = c?.id || "";
        }
      } catch (e) {
        console.warn("Prefill ID mapping failed:", e?.message);
      }

      setForm((prev) => ({
        ...prev,
        ...venue,
        days: Array.isArray(venue.days) ? venue.days : [],
        inclusions: venue.inclusions ?? [],
        addons: venue.addons ?? [],
        event_types: venue.event_types ?? [],
        amenities: venue.amenities ?? [],
        rules: venue.rules ?? [],
        street_line1: venue.street_line1 ?? "",
        barangay: venue.barangay ?? "",
        city: venue.city ?? "",
        province: venue.province ?? venue.state ?? "",
        region: venue.region ?? "",
        postal_code: venue.postal_code ?? "",
        country: venue.country ?? "PH",
        lat: lat ?? "",
        lng: lng ?? "",
        place_id: venue.place_id ?? "",
        formatted_address: venue.formatted_address ?? venue.address ?? "",
        rate_mode: venue.rate_mode ?? "single",
        rate: venue.rate ?? "",
        rate_weekday: venue.rate_weekday ?? venue.rate ?? "",
        rate_weekend: venue.rate_weekend ?? venue.rate ?? "",
        included_event_hours: venue.included_event_hours ?? 4,
        setup_time_mins: venue.setup_time_mins ?? 120,
        cleanup_time_mins: venue.cleanup_time_mins ?? 60,
        overtime_rate: venue.overtime_rate ?? "",
        early_loadin_allowed: !!venue.early_loadin_allowed,
        early_loadin_fee: venue.early_loadin_fee ?? "",
        nextday_pickup_allowed: !!venue.nextday_pickup_allowed,
        nextday_pickup_fee: venue.nextday_pickup_fee ?? "",
        open_time: venue.open_time ?? "08:00",
        close_time: venue.close_time ?? "22:00",
        video: venue.video ?? "",
        social: venue.social ?? "",

        region_id,
        province_id,
        city_id,

        // 🔹 Prefill payout fields with fallback
        payout_method: venue.payout_method || "gcash",
        payout_gcash: venue.payout_gcash || "",
        payout_bank_name: venue.payout_bank_name || "",
        payout_bank_account_name: venue.payout_bank_account_name || "",
        payout_bank_account_number: venue.payout_bank_account_number || "",
      }));

      setExistingImages(Array.isArray(venue.image_urls) ? venue.image_urls : []);
      setExistingBusinessDocs(
        Array.isArray(venue.business_docs) ? venue.business_docs : []
      );

      // If we already have lat/lng, give the map an initial focus
      if (lat && lng) {
        setMapFocus({ lat: Number(lat), lng: Number(lng), zoom: 16 });
      }
    })();
  }, [venueId]);

  /* Reservation fee display */
  const reservationSingle = useMemo(() => {
    const n = parseFloat(form.rate);
    return Number.isFinite(n) && n > 0 ? Math.round(n * 0.1) : "";
  }, [form.rate]);
  const reservationWeekday = useMemo(() => {
    const n = parseFloat(form.rate_weekday);
    return Number.isFinite(n) && n > 0 ? Math.round(n * 0.1) : "";
  }, [form.rate_weekday]);
  const reservationWeekend = useMemo(() => {
    const n = parseFloat(form.rate_weekend);
    return Number.isFinite(n) && n > 0 ? Math.round(n * 0.1) : "";
  }, [form.rate_weekend]);

  /* Gallery helpers (images) */
  function onPickFiles(e) {
    addNewFiles(Array.from(e.target.files || []));
  }
  function onDrop(e) {
    e.preventDefault();
    addNewFiles(Array.from(e.dataTransfer.files || []));
  }
  function addNewFiles(chosen) {
    const allowed = ["jpg", "jpeg", "png", "webp", "gif", "bmp"];
    const clean = chosen.filter((f) =>
      allowed.includes((f.name.split(".").pop() || "").toLowerCase())
    );
    const unique = clean.filter(
      (f) =>
        !files.some(
          (x) => x.name === f.name && x.lastModified === f.lastModified
        )
    );
    setFiles((prev) => [...prev, ...unique]);
  }
  function removeNewFile(idx) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }
  function removeExistingImage(url) {
    setExistingImages((prev) => prev.filter((u) => u !== url));
  }

  /* Business document helpers */
  function onPickDocs(e) {
    addNewDocs(Array.from(e.target.files || []));
  }
  function addNewDocs(chosen) {
    const clean = chosen.filter((f) => f.size > 0);
    const unique = clean.filter(
      (f) =>
        !businessDocs.some(
          (x) => x.name === f.name && x.lastModified === f.lastModified
        )
    );
    setBusinessDocs((prev) => [...prev, ...unique]);
  }
  function removeNewDoc(idx) {
    setBusinessDocs((prev) => prev.filter((_, i) => i !== idx));
  }
  function removeExistingDoc(url) {
    setExistingBusinessDocs((prev) => prev.filter((u) => u !== url));
  }

  async function compressImage(file, quality = 0.75, maxW = 1280) {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith("image/")) return resolve(file);
      const img = new Image();
      const reader = new FileReader();
      reader.onload = (ev) => (img.src = ev.target.result);
      reader.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            if (!blob) return resolve(file);
            resolve(
              new File([blob], file.name.replace(/\s+/g, "-"), {
                type: "image/jpeg",
              })
            );
          },
          "image/jpeg",
          quality
        );
      };
      img.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /* Form helpers */
  function toggleArrayField(field, value) {
    setForm((prev) => {
      const arr = new Set(prev[field] || []);
      arr.has(value) ? arr.delete(value) : arr.add(value);
      return { ...prev, [field]: Array.from(arr) };
    });
  }
  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  }
  function handleNumberChange(e) {
    const { name, value } = e.target;
    const v = value === "" ? "" : Number(value);
    setForm((prev) => ({ ...prev, [name]: v }));
  }
  function handleDaysChange(day) {
    toggleArrayField("days", day);
  }

  /* Wizard navigation & validation */
  const scrollTop = () =>
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });

  function validateStep(current) {
    if (current === 0) {
      if (!form.name?.trim())
        return { ok: false, msg: "Please enter a venue name." };
      if (!form.type)
        return { ok: false, msg: "Please select a venue type." };
      if (!form.capacity_max || Number(form.capacity_max) <= 0)
        return {
          ok: false,
          msg: "Please enter a valid maximum capacity.",
        };
      if (!form.description?.trim())
        return { ok: false, msg: "Please add a short description." };
      if (existingImages.length + files.length < 1)
        return { ok: false, msg: "Please upload at least one venue photo." };
    }
    if (current === 1) {
      if (form.rate_mode === "single") {
        if (!(Number(form.rate) > 0))
          return { ok: false, msg: "Enter a valid single rate." };
      } else {
        if (!(Number(form.rate_weekday) > 0 && Number(form.rate_weekend) > 0)) {
          return {
            ok: false,
            msg: "Enter valid weekday and weekend rates.",
          };
        }
      }
      if (!form.open_time || !form.close_time || form.open_time >= form.close_time) {
        return {
          ok: false,
          msg: "Set valid operating hours (Open before Close).",
        };
      }
    }
    if (current === 2) {
      if (!(Number(form.included_event_hours) > 0))
        return { ok: false, msg: "Select included event hours." };
    }
    if (current === 3) {
      if (!form.region_id)
        return { ok: false, msg: "Please pick a Region." };
      if (!form.province_id)
        return { ok: false, msg: "Please pick a Province." };
      if (!form.city_id)
        return { ok: false, msg: "Please pick a City/Municipality." };
      if (!form.lat || !form.lng)
        return { ok: false, msg: "Please set the map pin (lat/lng)." };
    }
    if (current === 5) {
      if (!form.contact_person?.trim())
        return { ok: false, msg: "Enter contact person." };
      if (!form.contact_number?.trim())
        return { ok: false, msg: "Enter contact number." };
      if (!form.contact_email?.trim())
        return { ok: false, msg: "Enter contact email." };

      // 🔹 Payout validation
      if (!form.payout_method) {
        return {
          ok: false,
          msg: "Select a payout method (GCash or Bank Transfer).",
        };
      }

      if (form.payout_method === "gcash") {
        if (!form.payout_gcash?.trim()) {
          return {
            ok: false,
            msg:
              "Enter your GCash number for payouts, or switch to Bank Transfer.",
          };
        }
      } else if (form.payout_method === "bank") {
        if (
          !form.payout_bank_name?.trim() ||
          !form.payout_bank_account_name?.trim() ||
          !form.payout_bank_account_number?.trim()
        ) {
          return {
            ok: false,
            msg:
              "Complete all bank payout fields (Bank Name, Account Name, Account Number).",
          };
        }
      }

      if (existingBusinessDocs.length + businessDocs.length < 1) {
        return {
          ok: false,
          msg:
            "Please upload at least one document as proof that your venue is a registered or legitimate business (e.g., DTI/SEC permit, business permit).",
        };
      }
    }
    return { ok: true };
  }

  function goNext() {
    const v = validateStep(step);
    if (!v.ok) {
      alert(v.msg);
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
    scrollTop();
  }
  function goBack() {
    setStep((s) => Math.max(s - 1, 0));
    scrollTop();
  }

  function goTo(targetIndex) {
    if (targetIndex === step) return;
    setStep(targetIndex);
    scrollTop();
  }

  function stepHasError(i) {
    return !validateStep(i).ok;
  }

  const stepErrors = useMemo(
    () => STEPS.map((_, i) => stepHasError(i)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [form, files, existingImages, businessDocs, existingBusinessDocs]
  );

  /* ========== Direct Nominatim search (no Supabase Edge) for dropdown → map center ========== */
  async function osmSearch(q) {
    if (!q?.trim()) return null;
    try {
      const url = new URL("https://nominatim.openstreetmap.org/search");
      url.searchParams.set("q", q);
      url.searchParams.set("format", "json");
      url.searchParams.set("limit", "1");
      const res = await fetch(url.toString(), {
        headers: {
          Accept: "application/json",
          "Accept-Language": "en",
        },
      });
      if (!res.ok) throw new Error(`OSM search failed: ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data) || !data.length) return null;
      const s = data[0];
      return { lat: Number(s.lat), lng: Number(s.lon) };
    } catch (err) {
      console.error("osmSearch error:", err);
      return null;
    }
  }

  /**
   * Resolve the currently selected city/province/region to a center point
   * Priority:
   *  1) ph_cities_muns.centroid_lat/lng (if present)
   *  2) Nominatim geocode of "City, Province, Philippines"
   *  3) Nominatim geocode of "Province, Philippines"
   *  4) Nominatim geocode of "Region, Philippines"
   */
  async function resolveDropdownCenter(regionId, provinceId, cityId) {
    const regionRow =
      regions.find((r) => r.id === regionId) ||
      regions.find((r) => r.id === regionId);
    const regionName = regionRow?.name || regionRow?.short_name;
    const provinceName = provinces.find((p) => p.id === provinceId)?.name;
    const cityName = cities.find((c) => c.id === cityId)?.name;

    // DB centroids first (if you add these cols later this will just work)
    if (cityId) {
      try {
        const { data } = await supabase
          .from("ph_cities_muns")
          .select("centroid_lat, centroid_lng")
          .eq("id", cityId)
          .maybeSingle();
        if (data?.centroid_lat && data?.centroid_lng) {
          return {
            lat: Number(data.centroid_lat),
            lng: Number(data.centroid_lng),
          };
        }
      } catch {
        // ignore if columns don’t exist
      }
    }

    // Fallback to public Nominatim
    if (cityName && provinceName) {
      const q = `${cityName}, ${provinceName}, Philippines`;
      const hit = await osmSearch(q);
      if (hit) return hit;
    }
    if (provinceName) {
      const q = `${provinceName}, Philippines`;
      const hit = await osmSearch(q);
      if (hit) return hit;
    }
    if (regionName) {
      const q = `${regionName}, Philippines`;
      const hit = await osmSearch(q);
      if (hit) return hit;
    }
    return null;
  }

  // Watch dropdowns; whenever they change, compute a center and push to map
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!form.region_id && !form.province_id && !form.city_id) {
        setMapFocus(null);
        return;
      }
      const center = await resolveDropdownCenter(
        form.region_id,
        form.province_id,
        form.city_id
      );
      if (!alive) return;
      if (center) {
        setMapFocus({
          ...center,
          zoom: form.city_id ? 14 : form.province_id ? 11 : 8,
        });
      }
    })();
    return () => {
      alive = false;
    };
  }, [form.region_id, form.province_id, form.city_id, regions, provinces, cities]);

  /* Celebration modal */
  async function celebrateSuccess(venueName = "Your listing") {
    let SwalLib = null;
    try {
      const mod = await import(/* @vite-ignore */ "sweetalert2");
      SwalLib = mod?.default || mod;
      if (!document.getElementById("swal2-css")) {
        const link = document.createElement("link");
        link.id = "swal2-css";
        link.rel = "stylesheet";
        link.href =
          "https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.css";
        document.head.appendChild(link);
      }
    } catch (e) {
      console.warn("SweetAlert2 not available, falling back to alert()", e);
    }

    // Confetti (optional)
    try {
      const { default: confetti } = await import(
        /* @vite-ignore */ "canvas-confetti"
      );
      const burst = (opts) =>
        confetti({
          spread: 70,
          startVelocity: 45,
          ticks: 200,
          scalar: 0.9,
          ...opts,
        });
      burst({ particleCount: 80, origin: { y: 0.7 } });
      setTimeout(
        () => burst({ particleCount: 60, origin: { y: 0.4 } }),
        250
      );
    } catch (e) {
      console.warn("Confetti not available (optional).", e);
    }

    if (!SwalLib) {
      alert(
        `🎉 Listing Published!\n\n${venueName} is now live on Eventlane.ph.\nYou’re ready to receive booking inquiries.`
      );
      return "view";
    }

    const res = await SwalLib.fire({
      title: "🎉 Listing Published!",
      html: `
      <div style="text-align:left;font-size:14px;line-height:1.45">
        <p><strong>${venueName}</strong> is now live on Eventlane.ph.</p>
        <ul style="margin:8px 0 0 18px">
          <li>Visible to users searching your area</li>
          <li>Ready to receive booking inquiries</li>
          <li>You can edit details anytime</li>
        </ul>
      </div>
    `,
      icon: "success",
      confirmButtonText: "View my listing",
      showCancelButton: true,
      cancelButtonText: "Add another",
      focusConfirm: true,
      backdrop: `rgba(99,91,255,.18)`,
    });

    return res.isConfirmed ? "view" : "add";
  }

  /* Submit */
  async function handleSubmit(e) {
    e.preventDefault();

    // validate all steps
    for (let i = 0; i < STEPS.length; i++) {
      const v = validateStep(i);
      if (!v.ok) {
        setStep(i);
        alert(v.msg);
        return;
      }
    }
    if (!authUser) {
      alert("❌ No session found. Please log in first.");
      return;
    }

    setLoading(true);

    // 1) Upload business documents (required)
    let newBusinessDocUrls = [];
    try {
      const docUploads = businessDocs.map(async (file) => {
        const safeName = file.name.replace(/\s+/g, "-");
        const path = `venue-docs/${authUser.id}/${Date.now()}-${safeName}`;
        const { error } = await supabase.storage
          .from("venue-docs")
          .upload(path, file);
        if (error) throw error;
        const { data } = supabase.storage
          .from("venue-docs")
          .getPublicUrl(path);
        return data.publicUrl;
      });
      newBusinessDocUrls = await Promise.all(docUploads);
    } catch (err) {
      console.error(err);
      setLoading(false);
      alert("❌ Document upload failed. Please try again.");
      return;
    }

    // 2) Upload images
    let newImageUrls = [];
    try {
      const uploads = files.map(async (file) => {
        const compressed = await compressImage(file, 0.75, 1280);
        const path = `theVenues/${Date.now()}-${compressed.name}`;
        const { error } = await supabase.storage
          .from("venue-images")
          .upload(path, compressed);
        if (error) throw error;
        const { data } = supabase.storage
          .from("venue-images")
          .getPublicUrl(path);
        return data.publicUrl;
      });
      newImageUrls = await Promise.all(uploads);
    } catch (err) {
      console.error(err);
      setLoading(false);
      alert("❌ Image upload failed. Please try again.");
      return;
    }

    // place_id safety (avoid UNIQUE violation)
    let safePlaceId = form.place_id || null;

    if (!venueId && safePlaceId) {
      try {
        const { data: existing, error: exErr } = await supabase
          .from("theVenues")
          .select("id")
          .eq("place_id", safePlaceId)
          .maybeSingle();

        if (exErr) {
          console.warn("place_id check failed:", exErr.message);
        } else if (existing) {
          console.warn("place_id already in use, clearing for this new venue");
          safePlaceId = null;
        }
      } catch (eCheck) {
        console.warn("place_id pre-check threw:", eCheck);
      }
    }

    const wd = parseFloat(form.rate_weekday);
    const singleRate = parseFloat(form.rate);
    const representativeRate =
      form.rate_mode === "split" ? wd || 0 : singleRate || 0;

    const derivedAddress =
      form.formatted_address ||
      [
        form.street_line1,
        form.barangay && `Brgy ${form.barangay}`,
        form.city,
        form.province,
        form.postal_code,
      ]
        .filter(Boolean)
        .join(", ") + (form.country ? `, ${form.country}` : "");

    const payload = {
      ...form,

      // 🔹 Normalize payout fields so only the chosen method is filled
      payout_method: form.payout_method || "gcash",
      payout_gcash:
        form.payout_method === "gcash"
          ? (form.payout_gcash || "").trim() || null
          : null,
      payout_bank_name:
        form.payout_method === "bank"
          ? (form.payout_bank_name || "").trim() || null
          : null,
      payout_bank_account_name:
        form.payout_method === "bank"
          ? (form.payout_bank_account_name || "").trim() || null
          : null,
      payout_bank_account_number:
        form.payout_method === "bank"
          ? (form.payout_bank_account_number || "").trim() || null
          : null,

      place_id: safePlaceId,
      image_urls: [...existingImages, ...newImageUrls],
      business_docs: [...existingBusinessDocs, ...newBusinessDocUrls], // ensure column exists (text[] / jsonb)
      rate_type: "Per Event",
      rate: form.rate_mode === "split" ? wd || 0 : singleRate || 0,
      rate_weekday: form.rate_mode === "split" ? wd || 0 : null,
      rate_weekend:
        form.rate_mode === "split"
          ? parseFloat(form.rate_weekend) || 0
          : null,
      reservation_fee_percent: RESERVATION_FEE_PERCENT,
      reservation_fee: Math.round((representativeRate || 0) * 0.1),
      open_time: form.open_time,
      close_time: form.close_time,
      hours: `${form.open_time}–${form.close_time}`,
      included_event_hours: Number(form.included_event_hours) || 0,
      setup_time_mins: Number(form.setup_time_mins) || 0,
      cleanup_time_mins: Number(form.cleanup_time_mins) || 0,
      overtime_rate:
        form.overtime_rate === "" ? null : Number(form.overtime_rate),
      early_loadin_allowed: !!form.early_loadin_allowed,
      early_loadin_fee:
        form.early_loadin_allowed && form.early_loadin_fee !== ""
          ? Number(form.early_loadin_fee)
          : null,
      nextday_pickup_allowed: !!form.nextday_pickup_allowed,
      nextday_pickup_fee:
        form.nextday_pickup_allowed && form.nextday_pickup_fee !== ""
          ? Number(form.nextday_pickup_fee)
          : null,
      notice: Number(form.notice) || 0,
      capacity_max: Number(form.capacity_max) || 0,
      region_id: form.region_id || null,
      province_id: form.province_id || null,
      city_id: form.city_id || null,
      address: derivedAddress,
      coordinates: `${form.lat}, ${form.lng}`,
      location: [
        form.barangay,
        cities.find((c) => c.id === form.city_id)?.name || form.city,
        provinces.find((p) => p.id === form.province_id)?.name ||
          form.province,
      ]
        .filter(Boolean)
        .join(" , "),
      platform_commission_percent: COMMISSION_PERCENT,
      initial_dp_percent: 10,
      booking_model: "fixed_reservation_10",
      updated_at: new Date().toISOString(),
      user_id: authUser.id,
    };

    try {
      let saved;
      if (venueId) {
        const { data, error } = await supabase
          .from("theVenues")
          .update(payload)
          .eq("id", venueId)
          .select("id,name")
          .single();
        if (error) throw error;
        saved = data;
      } else {
        const { data, error } = await supabase
          .from("theVenues")
          .insert([{ ...payload, status: "pending" }])
          .select("id,name")
          .single();
        if (error) throw error;
        saved = data;
      }

      setLoading(false);

      if (onSaved) {
        onSaved(saved);
      }

      const action = await celebrateSuccess(
        saved?.name || form.name || "Your listing"
      );

      if (action === "view" && saved?.id && navigate) {
        navigate(`/venues/${saved.id}`);
      } else if (!venueId && action === "add") {
        // reset for new entry
        setForm(defaultVenue);
        setFiles([]);
        setExistingImages([]);
        setBusinessDocs([]);
        setExistingBusinessDocs([]);
        setStep(0);
        setMapFocus(null);
        scrollTop();
      }
    } catch (err) {
      console.error(err);
      setLoading(false);
      alert("❌ Unable to save venue right now. Please try again.");
    }
  }

  return (
    <div className="vf-wrap">
      <form className="vf-form" onSubmit={handleSubmit}>
        <WizardStylesOnce />

        {/* Stepper */}
        <div className="vf-stepper" role="tablist" aria-label="Onboarding steps">
          {STEPS.map((label, i) => {
            const active = i === step;
            const isPast = i < step;
            const showErr = stepErrors[i] && isPast;
            const done = isPast && !stepErrors[i];

            return (
              <button
                key={label}
                type="button"
                role="tab"
                aria-selected={active}
                aria-current={active ? "step" : undefined}
                className={`vf-step ${active ? "is-active" : ""} ${
                  done ? "is-done" : ""
                } ${showErr ? "has-error" : ""}`}
                onClick={() => goTo(i)}
                title={showErr ? "Required fields missing" : label}
              >
                <span
                  className={`vf-step-index ${
                    showErr ? "has-error" : ""
                  }`}
                >
                  {i + 1}
                </span>
                <span className="vf-step-label">{label}</span>
              </button>
            );
          })}
        </div>

        <h2 className="vf-title" style={{ marginTop: 8 }}>
          {venueId ? "Edit Venue" : "Venue Listing"} —{" "}
          <span style={{ color: ACCENT }}>
            Step {step + 1} of {STEPS.length}
          </span>
        </h2>

        {/* =========== STEP 0: Photos & Basics =========== */}
        {step === 0 && (
          <section className="vf-card">
            {/* Gallery */}
            <label className="vf-label">Gallery Photos</label>
            <p className="vf-help">
              Upload clear photos of your venue (facade, inside, stage, etc.).
              This helps guests trust and choose your place faster.
            </p>
            <div
              ref={dropRef}
              className="drop-area"
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
              onClick={() =>
                document.getElementById("gallery-input").click()
              }
            >
              <p>📁 Drag & Drop images here or click to browse</p>
              <input
                id="gallery-input"
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={onPickFiles}
              />
              <div className="gallery-preview">
                {existingImages.map((url) => (
                  <div className="thumbnail-wrapper" key={url}>
                    <img src={url} alt="" />
                    <span
                      className="remove-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeExistingImage(url);
                      }}
                    >
                      &times;
                    </span>
                  </div>
                ))}
                {files.map((f, idx) => (
                  <div
                    className="thumbnail-wrapper"
                    key={`${f.name}-${idx}`}
                  >
                    <img src={URL.createObjectURL(f)} alt="" />
                    <span
                      className="remove-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeNewFile(idx);
                      }}
                    >
                      &times;
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Basics */}
            <label className="vf-label">
              Venue Name
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                required
              />
            </label>

            <label className="vf-label">
              Venue Type
              <select
                name="type"
                value={form.type}
                onChange={handleChange}
                required
              >
                {[
                  "Function Hall",
                  "Garden",
                  "Rooftop",
                  "Resort",
                  "Restaurant",
                  "Beachfront",
                  "Event Tent",
                  "Ballroom",
                  "Clubhouse",
                  "Auditorium",
                  "Studio",
                  "Conference Room",
                  "Others",
                ].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>

            <label className="vf-label">
              Maximum Capacity
              <input
                type="number"
                name="capacity_max"
                value={form.capacity_max}
                onChange={handleNumberChange}
                required
              />
            </label>

            <label className="vf-label">
              Venue Description
              <textarea
                name="description"
                rows={3}
                value={form.description}
                onChange={handleChange}
                required
              />
            </label>

            <label className="vf-label">
              Video Tour Link (optional)
              <input
                type="url"
                name="video"
                value={form.video || ""}
                onChange={handleChange}
                placeholder="https://"
              />
            </label>
          </section>
        )}

        {/* =========== STEP 1: Pricing & Schedule =========== */}
        {step === 1 && (
          <section className="vf-card">
            <h3 className="vf-h3" style={{ marginTop: 4 }}>
              Pricing
            </h3>
            <p className="vf-help">
              Set your base rate per event. Reservation fees and commission are
              automatically calculated for you.
            </p>
            <div className="vf-radio-group-inline">
              <label className="vf-chip">
                <input
                  type="radio"
                  name="rate_mode"
                  value="single"
                  checked={form.rate_mode === "single"}
                  onChange={() =>
                    setForm((f) => ({ ...f, rate_mode: "single" }))
                  }
                />
                <span className="vf-chip-text">Single Rate</span>
              </label>

              <label className="vf-chip">
                <input
                  type="radio"
                  name="rate_mode"
                  value="split"
                  checked={form.rate_mode === "split"}
                  onChange={() =>
                    setForm((f) => ({ ...f, rate_mode: "split" }))
                  }
                />
                <span className="vf-chip-text">Weekday/Weekend</span>
              </label>
            </div>

            {form.rate_mode === "single" ? (
              <>
                <label className="vf-label">
                  Rate (₱)
                  <input
                    type="number"
                    name="rate"
                    value={form.rate}
                    onChange={handleNumberChange}
                    required
                  />
                </label>
                <label className="vf-label">
                  Reservation Fee (₱){" "}
                  <small>
                    10% of Venue Rate (collected via Eventlane.ph)
                  </small>
                  <input
                    type="number"
                    value={reservationSingle}
                    readOnly
                    aria-readonly="true"
                  />
                </label>
              </>
            ) : (
              <>
                <label className="vf-label">
                  Weekday Rate (₱)
                  <input
                    type="number"
                    name="rate_weekday"
                    value={form.rate_weekday}
                    onChange={handleNumberChange}
                    required
                  />
                </label>
                <label className="vf-label">
                  Weekend Rate (₱)
                  <input
                    type="number"
                    name="rate_weekend"
                    value={form.rate_weekend}
                    onChange={handleNumberChange}
                    required
                  />
                </label>
                <label className="vf-label">
                  Reservation Fees (₱)
                  <div
                    className="vf-field"
                    style={{
                      display: "flex",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <span className="vf-chip">
                      10% (weekday):{" "}
                      <strong>₱{reservationWeekday || "—"}</strong>
                    </span>
                    <span className="vf-chip">
                      10% (weekend):{" "}
                      <strong>₱{reservationWeekend || "—"}</strong>
                    </span>
                  </div>
                </label>
              </>
            )}

            <h3 className="vf-h3" style={{ marginTop: 16 }}>
              Operating Schedule
            </h3>

            <label
              className="vf-label"
              style={{ marginBottom: 6 }}
            >
              Operating Days
            </label>
            <div className="vf-day-row">
              {[
                "Monday",
                "Tuesday",
                "Wednesday",
                "Thursday",
                "Friday",
                "Saturday",
                "Sunday",
              ].map((d) => {
                const on = form.days.includes(d);
                return (
                  <label
                    key={d}
                    className={`vf-day ${on ? "is-on" : ""}`}
                    title={d}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => handleDaysChange(d)}
                      aria-label={d}
                    />
                    <span>{d.slice(0, 3)}</span>
                  </label>
                );
              })}
            </div>

            <div
              className="vf-time-row"
              style={{ marginTop: 10 }}
            >
              <label className="vf-label vf-time-field">
                Open Time
                <input
                  type="time"
                  name="open_time"
                  value={form.open_time}
                  onChange={handleChange}
                />
              </label>
              <label className="vf-label vf-time-field">
                Close Time
                <input
                  type="time"
                  name="close_time"
                  value={form.close_time}
                  onChange={handleChange}
                />
              </label>
            </div>

            <label className="vf-label">
              Minimum Notice (days)
              <select
                name="notice"
                value={form.notice}
                onChange={handleNumberChange}
                required
              >
                <option value={0}>Same day</option>
                <option value={1}>1 day notice</option>
                <option value={2}>2 days notice</option>
                <option value={3}>3 days notice</option>
                <option value={5}>5 days notice</option>
                <option value={7}>1 week notice</option>
                <option value={14}>2 weeks notice</option>
                <option value={30}>1 month notice</option>
              </select>
            </label>
          </section>
        )}

        {/* =========== STEP 2: Hours & Buffers =========== */}
        {step === 2 && (
          <section className="vf-card">
            <h3 className="vf-h3">Event Hours & Buffers</h3>
            <p className="vf-help">
              Set how many hours are included, and how you handle overtime,
              setup, and cleanup windows.
            </p>

            <label className="vf-label">
              Included Event Hours
              <select
                name="included_event_hours"
                value={form.included_event_hours}
                onChange={handleNumberChange}
                required
              >
                {[3, 4, 5, 6, 8, 10, 12].map((h) => (
                  <option key={h} value={h}>
                    {h} hours
                  </option>
                ))}
              </select>
            </label>

            <label className="vf-label">
              Overtime Rate (₱/hour)
              <input
                type="number"
                name="overtime_rate"
                value={form.overtime_rate}
                onChange={handleNumberChange}
                min={0}
              />
            </label>

            <label className="vf-label">
              Complimentary Setup Time
              <select
                value={Math.round((form.setup_time_mins || 0) / 60)}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    setup_time_mins: Number(e.target.value) * 60,
                  }))
                }
              >
                {[0, 1, 2, 3, 4].map((h) => (
                  <option key={h} value={h}>
                    {h} {h === 1 ? "hour" : "hours"}
                  </option>
                ))}
              </select>
            </label>

            <label className="vf-label">
              Complimentary Cleanup Time
              <select
                value={Math.round((form.cleanup_time_mins || 0) / 60)}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    cleanup_time_mins: Number(e.target.value) * 60,
                  }))
                }
              >
                {[0, 1, 2, 3, 4].map((h) => (
                  <option key={h} value={h}>
                    {h} {h === 1 ? "hour" : "hours"}
                  </option>
                ))}
              </select>
            </label>
          </section>
        )}

        {/* =========== STEP 3: Location =========== */}
        {step === 3 && (
          <section className="vf-card">
            <h3 className="vf-h3">Venue Location</h3>
            <p className="vf-help">
              Choose your region / province / city, then drop a pin on the map
              to mark the exact venue location.
            </p>

            {/* Canonical pickers (IDs) */}
            <div
              className="vf-grid-3"
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 8,
              }}
            >
              {/* Region */}
              <div className="select-wrap">
                <select
                  className="vf-select"
                  value={form.region_id}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      region_id: e.target.value,
                      province_id: "",
                      city_id: "",
                    }))
                  }
                  disabled={regionsLoading || regions.length === 0}
                >
                  <option value="">
                    {regionsLoading
                      ? "Loading regions…"
                      : "Region"}
                  </option>
                  {regions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name || r.short_name}
                    </option>
                  ))}
                </select>
              </div>
              {/* Province */}
              <div className="select-wrap">
                <select
                  className="vf-select"
                  value={form.province_id}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      province_id: e.target.value,
                      city_id: "",
                    }))
                  }
                  disabled={!form.region_id || provincesLoading}
                >
                  <option value="">
                    {!form.region_id
                      ? "Province"
                      : provincesLoading
                      ? "Loading provinces…"
                      : provinces.length
                      ? "Province"
                      : "No provinces"}
                  </option>
                  {provinces.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              {/* City/Municipality */}
              <div className="select-wrap">
                <select
                  className="vf-select"
                  value={form.city_id}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      city_id: e.target.value,
                    }))
                  }
                  disabled={!form.province_id || citiesLoading}
                >
                  <option value="">
                    {!form.province_id
                      ? "City/Municipality"
                      : citiesLoading
                      ? "Loading cities…"
                      : cities.length
                      ? "City/Municipality"
                      : "No cities"}
                  </option>
                  {cities.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Map + text address */}
            <LocationPickerOSM
              initial={{
                lat: form.lat || 14.5995,
                lng: form.lng || 120.9842,
              }}
              focus={mapFocus}
              onResolved={(loc) => {
                setForm((prev) => ({
                  ...prev,
                  // keep dropdown IDs as-is
                  lat: loc.lat ?? prev.lat,
                  lng: loc.lng ?? prev.lng,
                  place_id: loc.place_id ?? prev.place_id,
                  formatted_address:
                    loc.formatted_address ?? prev.formatted_address,
                  street_line1: loc.street_line1 ?? prev.street_line1,
                  barangay: loc.barangay ?? prev.barangay,

                  // we can update the *text* city/province/region if you like,
                  // but it won’t touch region_id / province_id / city_id
                  city: loc.city ?? prev.city,
                  province: loc.province ?? prev.province,
                  region: loc.region ?? prev.region,

                  postal_code: loc.postal_code ?? prev.postal_code,
                  country: loc.country ?? prev.country,
                }));
              }}
            />

            {/* Hidden derived full address */}
            <input
              type="hidden"
              name="formatted_address"
              value={
                form.formatted_address ||
                [
                  form.street_line1,
                  form.barangay && `Brgy ${form.barangay}`,
                  cities.find((c) => c.id === form.city_id)?.name ||
                    form.city,
                  provinces.find((p) => p.id === form.province_id)
                    ?.name || form.province,
                  form.postal_code,
                ]
                  .filter(Boolean)
                  .join(", ") +
                  (form.country ? `, ${form.country}` : "")
              }
              readOnly
            />
          </section>
        )}

        {/* =========== STEP 4: Features (multi-selects) =========== */}
        {step === 4 && (
          <section className="vf-card">
            <h3 className="vf-h3">Features & Rules</h3>
            <p className="vf-help">
              Select everything that applies so guests know exactly what&apos;s
              included and what to expect.
            </p>

            <DropdownPills
              label="Inclusions"
              options={inclusionOptions}
              values={form.inclusions}
              onToggle={(v) => toggleArrayField("inclusions", v)}
            />
            <DropdownPills
              label="Add-ons / with Extra Charges"
              options={addonOptions}
              values={form.addons}
              onToggle={(v) => toggleArrayField("addons", v)}
            />
            <DropdownPills
              label="Accepted Event Types"
              options={eventTypeOptions}
              values={form.event_types}
              onToggle={(v) => toggleArrayField("event_types", v)}
            />
            <DropdownPills
              label="Amenities"
              options={amenityOptions}
              values={form.amenities}
              onToggle={(v) => toggleArrayField("amenities", v)}
            />
            <DropdownPills
              label="Venue Rules"
              options={ruleOptions}
              values={form.rules}
              onToggle={(v) => toggleArrayField("rules", v)}
            />
          </section>
        )}

        {/* =========== STEP 5: Contact & Verification =========== */}
        {step === 5 && (
          <section className="vf-card">
            <h3 className="vf-h3">Contact Details</h3>
            <p className="vf-help">
              These details will be used for booking coordination and payouts.
              Make sure they are active and accurate.
            </p>

            <label className="vf-label">
              Contact Person
              <input
                name="contact_person"
                value={form.contact_person}
                onChange={handleChange}
                required
              />
            </label>

            <label className="vf-label">
              Role
              <select
                name="contact_role"
                value={form.contact_role}
                onChange={handleChange}
                required
              >
                {[
                  "Owner",
                  "Manager",
                  "Staff",
                  "Marketing",
                  "Coordinator",
                  "Assistant",
                  "Others",
                ].map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>

            <label className="vf-label">
              Contact Number
              <input
                type="tel"
                name="contact_number"
                value={form.contact_number}
                onChange={handleChange}
                required
              />
            </label>

            <label className="vf-label">
              Contact Email
              <input
                type="email"
                name="contact_email"
                value={form.contact_email}
                onChange={handleChange}
                required
              />
            </label>

            <input
              type="hidden"
              name="social"
              value={form.social || ""}
            />

            {/* 🔹 Payout details */}
            <h3 className="vf-h3" style={{ marginTop: 20 }}>
              Payout Details
            </h3>
            <p className="vf-help">
              Choose how you want to receive reservation payouts collected by
              Eventlane.
            </p>

            <div className="vf-radio-group-inline" style={{ marginTop: 8 }}>
              <label className="vf-chip">
                <input
                  type="radio"
                  name="payout_method"
                  value="gcash"
                  checked={form.payout_method === "gcash"}
                  onChange={handleChange}
                />
                <span className="vf-chip-text">GCash</span>
              </label>

              <label className="vf-chip">
                <input
                  type="radio"
                  name="payout_method"
                  value="bank"
                  checked={form.payout_method === "bank"}
                  onChange={handleChange}
                />
                <span className="vf-chip-text">Bank Transfer</span>
              </label>
            </div>

            {form.payout_method === "gcash" && (
              <label className="vf-label">
                GCash Number
                <input
                  type="tel"
                  name="payout_gcash"
                  placeholder="0917XXXXXXX"
                  value={form.payout_gcash}
                  onChange={handleChange}
                />
                <span className="vf-help">
                  Use your active, verified GCash number. This is where we’ll
                  send your payouts.
                </span>
              </label>
            )}

            {form.payout_method === "bank" && (
              <>
                <label className="vf-label">
                  Bank Name
                  <input
                    name="payout_bank_name"
                    value={form.payout_bank_name}
                    onChange={handleChange}
                    placeholder="BPI, BDO, Metrobank, etc."
                  />
                </label>

                <label className="vf-label">
                  Account Name
                  <input
                    name="payout_bank_account_name"
                    value={form.payout_bank_account_name}
                    onChange={handleChange}
                    placeholder="Account holder name"
                  />
                </label>

                <label className="vf-label">
                  Account Number
                  <input
                    name="payout_bank_account_number"
                    value={form.payout_bank_account_number}
                    onChange={handleChange}
                    placeholder="XXXXXXXXXX"
                  />
                </label>
              </>
            )}

            <h3 className="vf-h3" style={{ marginTop: 20 }}>
              Business Verification
            </h3>
            <p className="vf-help">
              Upload at least one document to prove your venue is a registered
              or legitimate business. Examples: DTI/SEC registration, Mayor&apos;s
              Permit, Business Permit, or other official documents.
            </p>

            <div
              className="vf-doc-drop"
              onClick={() =>
                document.getElementById("business-docs-input").click()
              }
            >
              <p>📄 Drag & Drop files here or click to upload</p>
              <p className="vf-help-sm">
                Accepted: PDF, images, or scanned documents. Max a few files is
                enough.
              </p>
              <input
                id="business-docs-input"
                type="file"
                multiple
                hidden
                onChange={onPickDocs}
              />
              <div className="vf-doc-list">
                {existingBusinessDocs.map((url) => (
                  <div className="vf-doc-chip" key={url}>
                    <span className="vf-doc-name">
                      {url.split("/").slice(-1)[0]}
                    </span>
                    <button
                      type="button"
                      className="vf-doc-remove"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeExistingDoc(url);
                      }}
                    >
                      &times;
                    </button>
                  </div>
                ))}
                {businessDocs.map((f, idx) => (
                  <div className="vf-doc-chip" key={`${f.name}-${idx}`}>
                    <span className="vf-doc-name">{f.name}</span>
                    <button
                      type="button"
                      className="vf-doc-remove"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeNewDoc(idx);
                      }}
                    >
                      &times;
                    </button>
                  </div>
                ))}
                {existingBusinessDocs.length + businessDocs.length === 0 && (
                  <span className="vf-help-sm">
                    No document uploaded yet.
                  </span>
                )}
              </div>
            </div>

            <h3 className="vf-h3" style={{ marginTop: 20 }}>
              Terms & Privacy
            </h3>
            <p className="vf-help">
              By submitting this venue, you confirm that:
            </p>
            <ul className="vf-list">
              <li>
                The information you provided is true and accurate.
              </li>
              <li>
                You are authorized to list and accept bookings for this venue.
              </li>
              <li>
                You have read and agree to our{" "}
                <button
                  type="button"
                  className="vf-link-btn"
                  onClick={() => setShowTermsModal(true)}
                >
                  Terms of Service
                </button>{" "}
                and{" "}
                <button
                  type="button"
                  className="vf-link-btn"
                  onClick={() => setShowPrivacyModal(true)}
                >
                  Privacy Policy
                </button>
                .
              </li>
            </ul>
          </section>
        )}

        {/* Wizard controls */}
        <div className="vf-wizard-actions">
          {step > 0 ? (
            <button
              type="button"
              className="vf-btn outline"
              onClick={goBack}
            >
              Back
            </button>
          ) : (
            <span />
          )}

          {step < STEPS.length - 1 ? (
            <button
              type="button"
              className="vf-btn primary"
              onClick={goNext}
            >
              Next
            </button>
          ) : (
            <button
              type="submit"
              className="vf-btn primary"
              disabled={loading}
            >
              {loading
                ? "Saving..."
                : venueId
                ? "Save Changes"
                : "Submit Venue"}
            </button>
          )}
        </div>

        {/* Example modal */}
        {showExample && (
          <div
            className="vf-modal"
            onClick={() => setShowExample(false)}
          >
            <div
              className="vf-modal-content"
              onClick={(e) => e.stopPropagation()}
            >
              <h4 className="vf-h4">
                Example (Sample Price: ₱
                {(
                  form.rate_mode === "split"
                    ? parseFloat(form.rate_weekday) || 50000
                    : parseFloat(form.rate) || 50000
                ).toLocaleString()}
                )
              </h4>
              <ul className="vf-list">
                <li>
                  Reservation Fee (10% via Eventlane.ph):{" "}
                  <strong>
                    ₱
                    {Math.round(
                      (form.rate_mode === "split"
                        ? parseFloat(form.rate_weekday) || 50000
                        : parseFloat(form.rate) || 50000) * 0.1
                    ).toLocaleString()}
                  </strong>
                </li>
                <li>
                  Eventlane Commission (5% of total):{" "}
                  <strong>
                    ₱
                    {Math.round(
                      (form.rate_mode === "split"
                        ? parseFloat(form.rate_weekday) || 50000
                        : parseFloat(form.rate) || 50000) * 0.05
                    ).toLocaleString()}
                  </strong>{" "}
                  (deducted from the reservation fee)
                </li>
                <li>
                  Remaining 5% of the reservation fee goes to you as part of
                  the client&apos;s total payment.
                </li>
              </ul>
              <div className="vf-actions">
                <button
                  type="button"
                  className="vf-btn"
                  onClick={() => setShowExample(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Terms Modal */}
        {showTermsModal && (
          <div
            className="vf-modal"
            onClick={() => setShowTermsModal(false)}
          >
            <div
              className="vf-modal-content vf-modal-wide"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="vf-modal-header">
                <h3 className="vf-h3">Terms of Service</h3>
                <button
                  type="button"
                  className="vf-modal-close"
                  onClick={() => setShowTermsModal(false)}
                >
                  &times;
                </button>
              </div>
              <div className="vf-modal-body">
                <Terms />
              </div>
            </div>
          </div>
        )}

        {/* Privacy Modal */}
        {showPrivacyModal && (
          <div
            className="vf-modal"
            onClick={() => setShowPrivacyModal(false)}
          >
            <div
              className="vf-modal-content vf-modal-wide"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="vf-modal-header">
                <h3 className="vf-h3">Privacy Policy</h3>
                <button
                  type="button"
                  className="vf-modal-close"
                  onClick={() => setShowPrivacyModal(false)}
                >
                  &times;
                </button>
              </div>
              <div className="vf-modal-body">
                <Privacy />
              </div>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}

/* =========================
   Dropdown with pills
========================= */
function DropdownPills({ label, options, values, onToggle }) {
  const [open, setOpen] = useState(false);
  const selected = values || [];
  return (
    <div className="vf-dropdown">
      <label className="vf-label">{label}</label>
      <div
        className={`selectBox ${open ? "open" : ""}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="display-pills">
          {selected.length
            ? selected.map((v) => (
                <span key={v} className="selected-pill">
                  {v}
                </span>
              ))
            : `Select ${label.toLowerCase()}`}
        </span>
        <svg
          className="vf-caret"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M6 9l6 6 6-6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {open && (
        <div className="checkboxes">
          {options.map((opt) => (
            <label
              key={opt}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <input
                type="checkbox"
                checked={selected.includes(opt)}
                onChange={() => onToggle(opt)}
              />
              <span>{opt}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

/* =========================
   LocationPickerOSM (Leaflet + public Nominatim)
========================= */
function LocationPickerOSM({ initial, onResolved, focus }) {
  const mapEl = useRef(null);
  const inputRef = useRef(null);
  const suggestRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);

  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [leafletReady, setLeafletReady] = useState(!!window.L);
  const initializedRef = useRef(false);

  // Load Leaflet once
  useEffect(() => {
    if (window.L) {
      setLeafletReady(true);
      return;
    }
    const cssId = "leaflet-css";
    if (!document.getElementById(cssId)) {
      const link = document.createElement("link");
      link.id = cssId;
      link.rel = "stylesheet";
      link.href =
        "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }
    const scriptId = "leaflet-js";
    if (!document.getElementById(scriptId)) {
      const script = document.createElement("script");
      script.id = scriptId;
      script.src =
        "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.async = true;
      script.onload = () => setLeafletReady(true);
      document.body.appendChild(script);
    } else {
      setLeafletReady(true);
    }
  }, []);

  // Init map
  useEffect(() => {
    if (!leafletReady || !mapEl.current || initializedRef.current)
      return;
    initMap();
    initializedRef.current = true;
    return () => {
      try {
        if (markerRef.current) {
          markerRef.current.off();
          markerRef.current = null;
        }
        if (mapRef.current) {
          mapRef.current.off();
          mapRef.current.remove();
          mapRef.current = null;
        }
      } catch {}
      initializedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leafletReady]);

  function initMap() {
    const L = window.L;
    if (!L || !mapEl.current) return;
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const center =
      initial?.lat && initial?.lng
        ? [Number(initial.lat), Number(initial.lng)]
        : [14.5995, 120.9842];

    mapRef.current = L.map(mapEl.current, {
      center,
      zoom: 15,
      zoomControl: true,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(mapRef.current);

    markerRef.current = L.marker(center, { draggable: true }).addTo(
      mapRef.current
    );
    markerRef.current.on("dragend", handleMarkerDrag);
    mapRef.current.on("click", handleMapClick);

    onResolved?.({ lat: center[0], lng: center[1] });
  }

  async function handleMarkerDrag() {
    const pos = markerRef.current.getLatLng();
    await reverseGeocode(pos.lat, pos.lng);
  }
  async function handleMapClick(e) {
    markerRef.current.setLatLng([e.latlng.lat, e.latlng.lng]);
    await reverseGeocode(e.latlng.lat, e.latlng.lng);
  }

  // Direct Nominatim
  async function geoSearch(q) {
    if (!q?.trim()) return [];
    try {
      const url = new URL("https://nominatim.openstreetmap.org/search");
      url.searchParams.set("q", q);
      url.searchParams.set("format", "jsonv2");
      url.searchParams.set("addressdetails", "1");
      url.searchParams.set("limit", "8");
      const res = await fetch(url.toString(), {
        headers: {
          Accept: "application/json",
          "Accept-Language": "en",
        },
      });
      if (!res.ok) throw new Error(`search failed: ${res.status}`);
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (e) {
      console.error("Nominatim search error:", e);
      return [];
    }
  }

  async function geoReverse(lat, lon) {
    try {
      const url = new URL(
        "https://nominatim.openstreetmap.org/reverse"
      );
      url.searchParams.set("lat", String(lat));
      url.searchParams.set("lon", String(lon));
      url.searchParams.set("format", "jsonv2");
      url.searchParams.set("addressdetails", "1");
      const res = await fetch(url.toString(), {
        headers: {
          Accept: "application/json",
          "Accept-Language": "en",
        },
      });
      if (!res.ok) throw new Error(`reverse failed: ${res.status}`);
      return await res.json();
    } catch (e) {
      console.error("Nominatim reverse error:", e);
      return null;
    }
  }

  async function searchNominatim(q) {
    if (!q?.trim()) {
      setSuggestions([]);
      return;
    }
    const data = await geoSearch(q);
    setSuggestions(data);
  }

  function buildFormatted(a) {
    return (
      [
        a.street_line1,
        a.barangay && `Brgy ${a.barangay}`,
        a.city,
        a.province,
        a.postal_code,
      ]
        .filter(Boolean)
        .join(", ") + (a.country ? `, ${a.country}` : "")
    );
  }

  function parseAddressOSM(addr) {
    const street = [addr.house_number, addr.road]
      .filter(Boolean)
      .join(" ")
      .trim();
    const barangay =
      addr.barangay ||
      addr.neighbourhood ||
      addr.suburb ||
      addr.village ||
      "";
    const city =
      addr.city || addr.town || addr.municipality || addr.county || "";
    const province = addr.state || addr.region || "";
    const region =
      addr["ISO3166-2-lvl4"] ||
      addr.state_code ||
      "";
    const postal = addr.postcode || "";
    const country = (addr.country_code || "ph").toUpperCase();
    return {
      street_line1: street,
      barangay,
      city,
      province,
      region,
      postal_code: postal,
      country,
    };
  }

  async function reverseGeocode(lat, lon) {
    try {
      const data = await geoReverse(lat, lon);
      if (!data) {
        onResolved?.({ lat, lng: lon });
        return;
      }
      const parsed = parseAddressOSM(data.address || {});
      const formatted =
        data.display_name || buildFormatted(parsed);
      onResolved?.({
        ...parsed,
        lat,
        lng: lon,
        place_id: data.place_id ? `osm:${data.place_id}` : "",
        formatted_address: formatted,
      });
      setQuery(formatted);
    } catch (e) {
      console.error("reverseGeocode error:", e);
      onResolved?.({ lat, lng: lon });
    }
  }

  function focusSuggestion(lat, lon, display_name, address, place_id) {
    const L = window.L;
    if (!L || !mapRef.current || !markerRef.current) return;
    const pos = [Number(lat), Number(lon)];
    mapRef.current.setView(pos, 17);
    markerRef.current.setLatLng(pos);
    const parsed = parseAddressOSM(address || {});
    const formatted =
      display_name || buildFormatted(parsed);
    onResolved?.({
      ...parsed,
      lat: pos[0],
      lng: pos[1],
      place_id: place_id ? `osm:${place_id}` : "",
      formatted_address: formatted,
    });
    setQuery(formatted);
    setSuggestions([]);
  }

  // Focus from parent (Region/Province/City selection)
  useEffect(() => {
    if (!focus || !window.L || !mapRef.current) return;
    const { lat, lng, zoom } = focus;
    if (typeof lat !== "number" || typeof lng !== "number") return;
    mapRef.current.setView(
      [lat, lng],
      typeof zoom === "number"
        ? zoom
        : mapRef.current.getZoom()
    );
  }, [focus]);

  return (
    <div>
      <label className="vf-label">Pin venue location</label>

      <div
        className="vf-geo-wrapper"
        style={{ position: "relative", zIndex: 2 }}
      >
        <input
          ref={inputRef}
          placeholder="Type street/building…"
          value={query}
          onChange={(e) => {
            const v = e.target.value;
            setQuery(v);
            if (suggestRef.current)
              clearTimeout(suggestRef.current);
            suggestRef.current = setTimeout(
              () => searchNominatim(v),
              350
            );
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (suggestions.length > 0) {
                const s = suggestions[0];
                focusSuggestion(
                  s.lat,
                  s.lon,
                  s.display_name,
                  s.address,
                  s.place_id
                );
              } else {
                searchNominatim(query);
              }
            }
          }}
        />
        {suggestions.length > 0 && (
          <div
            className="vf-geo-suggest"
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              maxHeight: 240,
              overflowY: "auto",
              boxShadow:
                "0 6px 18px rgba(0,0,0,0.08)",
            }}
          >
            {suggestions.map((sug) => (
              <div
                key={sug.place_id}
                style={{
                  padding: "8px 10px",
                  cursor: "pointer",
                }}
                onClick={() =>
                  focusSuggestion(
                    sug.lat,
                    sug.lon,
                    sug.display_name,
                    sug.address,
                    sug.place_id
                  )
                }
              >
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  {sug.display_name}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "#6b7280",
                  }}
                >
                  {sug.type} • {sug.class}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div
        ref={mapEl}
        className="vf-map"
        style={{
          height: 300,
          borderRadius: 12,
          marginTop: 8,
          overflow: "hidden",
          position: "relative",
          zIndex: 1,
          boxShadow: "0 12px 30px rgba(15,23,42,0.18)",
        }}
      />

      {!leafletReady && (
        <small className="vf-help">Loading map…</small>
      )}
      <small className="vf-help">
        Drag/click map to set precise pin. © OpenStreetMap
      </small>
    </div>
  );
}

/* =========================
   Stepper + Buttons styles (Canva-ish, arrow fix)
========================= */
function WizardStylesOnce() {
  useEffect(() => {
    if (document.getElementById("vf-wizard-styles")) return;
    const css = `
    .vf-wrap{
      padding: 12px;
      background:
        radial-gradient(600px 320px at 0% 0%, rgba(99,91,255,0.08), transparent 60%),
        radial-gradient(520px 260px at 100% 0%, rgba(255,106,213,0.07), transparent 60%),
        #f5f7fb;
    }
    .vf-form{
      margin:auto;
      max-width: 960px;
      padding: 18px 18px 24px;
      border-radius: 24px;
      background: rgba(255,255,255,0.96);
      border: 1px solid rgba(148,163,184,0.22);
      box-shadow: 0 20px 70px rgba(15,23,42,0.18);
    }
    .vf-title{
      font-size: 18px;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: #0f172a;
    }
    .vf-stepper{
      display:grid;
      grid-template-columns: repeat(6, minmax(0,1fr));
      gap:10px; margin-bottom:16px;
    }
    .vf-step{
      display:flex; align-items:center; gap:8px;
      padding:5px 7px; border:1px solid #E5E7EB; border-radius:12px;
      background:#fff; color:#334155; font-weight:500; font-size:10px;
      box-shadow: 0 1px 1px rgba(0,0,0,.02);
      min-width: 0;
    }
    .vf-step .vf-step-label{
      overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
    }
    .vf-step .vf-step-index{
      inline-size: 28px;
      block-size: 28px;
      aspect-ratio: 1 / 1;
      border-radius: 50%;
      display: grid;
      place-items: center;
      border: 2px solid #CBD5E1;
      background: #F8FAFC;
      font-weight: 800;
      font-size: 12px;
      line-height: 1;
      color: #0f172a;
      flex: 0 0 auto;
    }

    .vf-step.is-active .vf-step-index{
      border-color: ${ACCENT};
      background: #e4e5ff;
      color: #312e81;
    }
    .vf-step.is-done .vf-step-index{
      border-color: ${ACCENT};
      background: ${ACCENT};
      color: #fff;
    }

    .vf-step.is-active{
      border-color: ${ACCENT};
      background-color: rgba(99,91,255,0.06);
    }
    .vf-wizard-actions{
      display:flex; align-items:center; justify-content:space-between;
      margin-top: 14px; gap: 10px;
    }
    .vf-btn{
      padding: 12px 16px; border-radius: 12px; font-weight: 800; font-size: 14px;
      border: 1px solid transparent; cursor: pointer; transition: transform .08s ease, box-shadow .2s ease, background .2s ease, border-color .2s ease;
    }
    .vf-btn.primary{
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      color: #fff;
      box-shadow: 0 8px 20px rgba(99,91,255,.22);
    }
    .vf-btn.primary:hover{
      filter: brightness(1.04);
      transform: translateY(-1px);
    }
    .vf-btn.outline{
      background:#fff;
      color:${ACCENT};
      border-color:${ACCENT};
    }
    .vf-btn.outline:hover{
      background: rgba(99,91,255,.08);
      transform: translateY(-1px);
    }
    @media (max-width: 900px){
      .vf-stepper{ grid-template-columns: repeat(3, minmax(0,1fr)); }
      .vf-form{ padding: 14px 12px 18px; }
    }

    .vf-stepper .vf-step{
      cursor: pointer;
      background:#fff;
    }
    .vf-stepper .vf-step:disabled{
      cursor: default;
      opacity:.7;
    }
    .vf-stepper .vf-step:focus{
      outline: none;
      box-shadow: 0 0 0 2px rgba(99,91,255,.28);
    }

    .vf-step .vf-step-index.has-error{
      border-color:#ef4444; background:#fee2e2; color:#b91c1c;
    }
    .vf-step.is-active .vf-step-index.has-error{
      border-color:#dc2626; background:#ef4444; color:#fff;
    }
    .vf-step.has-error .vf-step-label{
      text-decoration: underline dotted #ef4444 1px;
      text-underline-offset: 2px;
    }

    .thumbnail-wrapper {
      position: relative;
      display: inline-block;
    }
    .thumbnail-wrapper img{
      max-width: 120px;
      max-height: 120px;
      border-radius: 10px;
      object-fit: cover;
    }

    .remove-btn {
      position: absolute;
      top: -8px;
      right: -8px;
      background-color: #ef4444;
      color: white;
      border-radius: 50%;
      width: 24px;
      height: 24px;
      display: flex;
      justify-content: center;
      align-items: center;
      font-size: 14px;
      font-weight: bold;
      cursor: pointer;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      transition: background-color 0.2s ease;
    }
    .remove-btn:hover {
      background-color: #dc2626;
    }

    .vf-card{
      margin-top: 10px;
      padding: 14px 14px 16px;
      border-radius: 18px;
      background: #ffffff;
      border: 1px solid rgba(148,163,184,0.25);
      box-shadow: 0 10px 30px rgba(15,23,42,0.08);
    }
    .vf-label{
      display:flex;
      flex-direction:column;
      gap:4px;
      margin-top:10px;
      font-size: 13px;
      font-weight: 600;
      color:#0f172a;
    }
    .vf-label input,
    .vf-label select,
    .vf-label textarea{
      border-radius: 10px;
      border:1px solid #CBD5E1;
      padding: 8px 10px;
      font-size: 14px;
      outline:none;
      background:#F8FAFC;
      transition: border-color .16s ease, box-shadow .16s ease, background .16s ease;
    }
    .vf-label textarea{
      resize: vertical;
      min-height: 72px;
    }
    .vf-label input:focus,
    .vf-label select:focus,
    .vf-label textarea:focus{
      border-color: ${ACCENT};
      background:#ffffff;
      box-shadow: 0 0 0 1px rgba(99,91,255,.18);
    }

    .vf-h3{
      font-size: 15px;
      font-weight: 800;
      letter-spacing: -.02em;
      color:#0f172a;
    }
    .vf-h4{
      font-size: 14px;
      font-weight: 700;
      color:#0f172a;
      margin-bottom: 6px;
    }
    .vf-help{
      font-size: 12px;
      color:#6b7280;
      margin-top:4px;
    }
    .vf-help-sm{
      font-size: 11px;
      color:#94a3b8;
      margin-top:4px;
    }
    .vf-list{
      margin: 8px 0 0 18px;
      padding: 0;
      font-size: 13px;
      color:#4b5563;
      line-height: 1.5;
    }

    .vf-radio-group-inline{
      display:flex;
      flex-wrap:wrap;
      gap:8px;
      margin-top:8px;
    }
    .vf-chip{
      display:inline-flex;
      align-items:center;
      gap:6px;
      padding:5px 10px;
      border-radius: 999px;
      border:1px solid #E5E7EB;
      background:#F9FAFB;
      cursor:pointer;
      font-size:12px;
      color:#4b5563;
    }
    .vf-chip input{
      margin:0;
    }
    .vf-chip-text{
      font-weight:600;
    }

    .vf-day-row{
      display:flex;
      flex-wrap:wrap;
      gap:6px;
      margin-top:4px;
    }
    .vf-day{
      border-radius:999px;
      padding:4px 9px;
      border:1px solid #E5E7EB;
      background:#F9FAFB;
      font-size:12px;
      cursor:pointer;
      display:inline-flex;
      align-items:center;
      gap:6px;
    }
    .vf-day input{
      display:none;
    }
    .vf-day span{
      font-weight:600;
      color:#4b5563;
    }
    .vf-day.is-on{
      border-color:${ACCENT};
      background:rgba(99,91,255,.08);
      color:${ACCENT};
    }

    .vf-time-row{
      display:flex;
      gap:8px;
      flex-wrap:wrap;
    }
    .vf-time-field{
      flex:1 1 0;
    }

    .vf-dropdown{
      margin-top: 10px;
    }
    .selectBox{
      border-radius: 10px;
      border:1px solid #CBD5E1;
      padding: 8px 10px;
      background:#F9FAFB;
      cursor:pointer;
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:6px;
      transition: border-color .16s ease, box-shadow .16s ease, background .16s ease;
    }
    .selectBox.open{
      border-color:${ACCENT};
      background:#ffffff;
      box-shadow: 0 0 0 1px rgba(99,91,255,.18);
    }
    .display-pills{
      display:flex;
      flex-wrap:wrap;
      gap:4px;
      font-size: 12px;
      color:#6b7280;
    }
    .selected-pill{
      border-radius: 999px;
      padding:2px 8px;
      background:#EEF2FF;
      color:#4f46e5;
      font-size:11px;
      font-weight:600;
    }
    .vf-caret{
      flex:0 0 auto;
      color:#9ca3af;
    }
    .checkboxes{
      margin-top: 6px;
      padding: 8px 10px;
      border-radius: 10px;
      background:#F9FAFB;
      border:1px solid #E5E7EB;
      max-height: 180px;
      overflow-y:auto;
    }

    .vf-select{
      -webkit-appearance: none;
      -moz-appearance: none;
      appearance: none;
      background-image: none !important;
      background-color: #fff;
      padding-right: 26px;
    }
    .vf-grid-3 .select-wrap{
      position: relative;
    }

    .vf-doc-drop{
      margin-top: 8px;
      padding: 12px;
      border-radius: 14px;
      border: 1px dashed #cbd5e1;
      background: #f9fafb;
      cursor:pointer;
      text-align:center;
      transition: border-color .16s ease, background .16s ease;
    }
    .vf-doc-drop:hover{
      border-color:#635bff;
      background:#eef2ff;
    }
    .vf-doc-list{
      margin-top: 8px;
      display:flex;
      flex-wrap:wrap;
      gap:6px;
      justify-content:flex-start;
    }
    .vf-doc-chip{
      display:inline-flex;
      align-items:center;
      gap:4px;
      border-radius:999px;
      background:#e5e7eb;
      padding:3px 8px;
      font-size:11px;
      color:#111827;
    }
    .vf-doc-name{
      max-width: 180px;
      overflow:hidden;
      text-overflow:ellipsis;
      white-space:nowrap;
    }
    .vf-doc-remove{
      border:none;
      background:transparent;
      color:#ef4444;
      font-weight:700;
      cursor:pointer;
      padding:0;
    }

    .vf-actions-inline{
      margin-top: 10px;
      display:flex;
      justify-content:flex-start;
    }

    .vf-link-btn{
      border:none;
      background:transparent;
      padding:0;
      margin:0;
      font-size: 12px;
      color:${ACCENT};
      cursor:pointer;
      text-decoration: underline;
      text-underline-offset: 2px;
      font-weight: 600;
    }

    /* Modal (generic, used by example + terms + privacy) */
    .vf-modal{
      position: fixed;
      inset: 0;
      background: rgba(15,23,42,0.55);
      display:flex;
      align-items:center;
      justify-content:center;
      padding: 16px;
      z-index: 9999;
      backdrop-filter: blur(4px);
    }
    .vf-modal-content{
      background:#ffffff;
      border-radius: 18px;
      max-width: 480px;
      width:100%;
      max-height: 80vh;
      overflow:auto;
      padding: 16px 16px 18px;
      box-shadow: 0 18px 60px rgba(15,23,42,0.4);
      border: 1px solid rgba(148,163,184,0.35);
    }
    .vf-modal-wide{
      max-width: 820px;
    }
    .vf-modal-header{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:8px;
      margin-bottom: 8px;
    }
    .vf-modal-body{
      padding-top: 4px;
    }
    .vf-modal-close{
      border:none;
      background:rgba(248,250,252,0.9);
      border-radius:999px;
      width:30px;
      height:30px;
      display:flex;
      align-items:center;
      justify-content:center;
      font-size:18px;
      cursor:pointer;
      color:#0f172a;
    }
    .vf-actions{
      margin-top: 10px;
      display:flex;
      justify-content:flex-end;
    }

    `;
    const style = document.createElement("style");
    style.id = "vf-wizard-styles";
    style.textContent = css;
    document.head.appendChild(style);
  }, []);
  return null;
}
