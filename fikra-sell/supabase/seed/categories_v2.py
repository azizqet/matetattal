#!/usr/bin/env python3
"""FIKRA SELL · category tree v2 (12 main sections) → migration 0015.

Run: python3 supabase/seed/categories_v2.py
Fields may attach to a main section (inherited by every subsection) or to a
single subsection (key "fields" inside the sub tuple's dict).
"""
import json, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "migrations" / "20261126000015_categories_v2.sql"

def o(*pairs):
    return [{"v": v, "ar": a, "en": e} for v, a, e in pairs]

def F(key, ar, en, typ, **kw):
    return dict(key=key, label_ar=ar, label_en=en, type=typ, **kw)

YES_NO = o(("yes", "نعم", "Yes"), ("no", "لا", "No"))
CAR_MAKES = o(*[(m.lower().replace(" ", "-"), a, m) for m, a in [
    ("Toyota", "تويوتا"), ("Lexus", "لكزس"), ("Nissan", "نيسان"), ("Infiniti", "إنفينيتي"), ("Mercedes-Benz", "مرسيدس"),
    ("BMW", "بي إم دبليو"), ("Audi", "أودي"), ("Porsche", "بورش"), ("Land Rover", "لاند روفر"), ("Chevrolet", "شفروليه"),
    ("GMC", "جي إم سي"), ("Cadillac", "كاديلاك"), ("Ford", "فورد"), ("Lincoln", "لينكون"), ("Dodge", "دودج"), ("Jeep", "جيب"),
    ("RAM", "رام"), ("Hyundai", "هيونداي"), ("Kia", "كيا"), ("Genesis", "جينيسيس"), ("Honda", "هوندا"), ("Mazda", "مازدا"),
    ("Mitsubishi", "ميتسوبيشي"), ("Suzuki", "سوزوكي"), ("Volkswagen", "فولكس واجن"), ("Volvo", "فولفو"), ("MG", "إم جي"),
    ("Changan", "شانجان"), ("Geely", "جيلي"), ("Chery", "شيري"), ("Haval", "هافال"), ("Tesla", "تسلا"), ("Bentley", "بنتلي"),
    ("Rolls-Royce", "رولز رويس"), ("Ferrari", "فيراري"), ("Lamborghini", "لامبورغيني"), ("Maserati", "مازيراتي"), ("Other", "أخرى")]])
BIKE_MAKES = o(("harley-davidson", "هارلي ديفيدسون", "Harley-Davidson"), ("honda", "هوندا", "Honda"), ("yamaha", "ياماها", "Yamaha"),
               ("kawasaki", "كاواساكي", "Kawasaki"), ("suzuki", "سوزوكي", "Suzuki"), ("ducati", "دوكاتي", "Ducati"), ("bmw", "بي إم دبليو", "BMW"),
               ("ktm", "كي تي إم", "KTM"), ("polaris", "بولاريس", "Polaris"), ("can-am", "كان آم", "Can-Am"), ("other", "أخرى", "Other"))
YEAR = lambda req=False: F("year", "سنة الصنع", "Year", "year", min_value=1950, max_value=2027, is_required=req)
MILEAGE = F("mileage", "المسافة المقطوعة", "Mileage", "number", unit_ar="كم", unit_en="km", min_value=0, max_value=2000000)
GENDER = F("gender", "الجنس", "Gender", "select", options=o(("male", "ذكر", "Male"), ("female", "أنثى", "Female"), ("pair", "زوج", "Pair")))
STORAGE = F("storage", "سعة التخزين", "Storage", "select", options=o(("64", "64GB", "64GB"), ("128", "128GB", "128GB"), ("256", "256GB", "256GB"), ("512", "512GB", "512GB"), ("1024", "1TB", "1TB")))

# (slug, ar, en, icon, price_label, has_condition, [fields on main], [ (sub_slug, ar, en, {price_label?, fields?}) ])
TREE = [
  ("cars", "السيارات والمركبات", "Cars & vehicles", "car", "price", True, [], [
    ("cars-sale", "سيارات للبيع", "Cars for sale", {"fields": [
        F("make", "الشركة المصنعة", "Make", "select", options=CAR_MAKES, is_required=True),
        F("model", "الموديل", "Model", "text", is_filterable=False), YEAR(True), MILEAGE,
        F("transmission", "ناقل الحركة", "Transmission", "select", options=o(("automatic", "أوتوماتيك", "Automatic"), ("manual", "يدوي", "Manual"))),
        F("fuel", "نوع الوقود", "Fuel", "select", options=o(("petrol", "بنزين", "Petrol"), ("diesel", "ديزل", "Diesel"), ("hybrid", "هايبرد", "Hybrid"), ("electric", "كهربائي", "Electric"))),
        F("body", "نوع الهيكل", "Body type", "select", options=o(("sedan", "سيدان", "Sedan"), ("suv", "دفع رباعي", "SUV"), ("pickup", "بيك أب", "Pickup"), ("coupe", "كوبيه", "Coupe"), ("hatchback", "هاتشباك", "Hatchback"), ("van", "فان", "Van"))),
        F("color", "اللون", "Color", "text", is_filterable=False)]}),
    ("cars-rent", "سيارات للإيجار", "Cars for rent", {"price_label": "rent", "fields": [F("make", "الشركة المصنعة", "Make", "select", options=CAR_MAKES), YEAR()]}),
    ("cars-classic", "سيارات كلاسيكية", "Classic cars", {"fields": [F("make", "الشركة المصنعة", "Make", "select", options=CAR_MAKES), YEAR(), MILEAGE]}),
    ("motorcycles", "دراجات نارية وبقيات", "Motorcycles & ATVs", {"fields": [F("make", "الشركة المصنعة", "Make", "select", options=BIKE_MAKES), YEAR(), MILEAGE,
        F("engine_cc", "سعة المحرك", "Engine size", "number", unit_ar="سي سي", unit_en="cc", min_value=0, max_value=3000)]}),
    ("auto-parts", "قطع غيار وإكسسوارات", "Parts & accessories", {"fields": [
        F("part_type", "نوع القطعة", "Part type", "select", options=o(("engine", "محرك وقطعه", "Engine"), ("wheels", "جنوط وإطارات", "Wheels & tyres"), ("body", "بودي وهيكل", "Body"), ("electric", "كهرباء", "Electrical"), ("interior", "داخلية", "Interior"), ("accessories", "إكسسوارات", "Accessories"))),
        F("compatible_make", "متوافق مع", "Fits make", "select", options=CAR_MAKES)]}),
    ("trucks", "شاحنات وباصات", "Trucks & buses", {"fields": [F("make", "الشركة المصنعة", "Make", "text"), YEAR(), MILEAGE]}),
    ("boats", "قوارب وجت سكي", "Boats & jet skis", {"fields": [YEAR(), F("length_ft", "الطول", "Length", "number", unit_ar="قدم", unit_en="ft", min_value=1, max_value=300)]}),
    ("cars-wanted", "مطلوب سيارات", "Wanted", {}),
  ]),
  ("real-estate", "العقارات", "Real estate", "building", "price", False, [
    F("area_sqm", "المساحة", "Area", "number", unit_ar="م²", unit_en="m²", min_value=1, max_value=1000000),
    F("bedrooms", "عدد الغرف", "Bedrooms", "select", options=o(("0", "استوديو", "Studio"), ("1", "1", "1"), ("2", "2", "2"), ("3", "3", "3"), ("4", "4", "4"), ("5", "5", "5"), ("6", "6+", "6+"))),
    F("bathrooms", "عدد الحمامات", "Bathrooms", "select", options=o(("1", "1", "1"), ("2", "2", "2"), ("3", "3", "3"), ("4", "4+", "4+"))),
    F("furnished", "التأثيث", "Furnishing", "select", options=o(("furnished", "مفروش", "Furnished"), ("semi", "شبه مفروش", "Semi"), ("unfurnished", "غير مفروش", "Unfurnished"))),
  ], [
    ("re-apartments-rent", "شقق للإيجار", "Apartments for rent", {"price_label": "rent"}),
    ("re-apartments-sale", "شقق للبيع", "Apartments for sale", {}),
    ("re-houses-sale", "بيوت للبيع", "Houses for sale", {}),
    ("re-houses-rent", "بيوت للإيجار", "Houses for rent", {"price_label": "rent"}),
    ("re-land", "أراضي", "Land", {}),
    ("re-chalets", "شاليهات", "Chalets", {}),
    ("re-commercial", "محلات ومكاتب", "Shops & offices", {}),
    ("re-abroad", "عقارات خارج الكويت", "Property abroad", {}),
  ]),
  ("electronics", "الإلكترونيات والهواتف", "Electronics & phones", "mobile", "price", True,
    [F("warranty", "عليه ضمان", "Under warranty", "select", options=YES_NO)], [
    ("phones-iphone", "آيفون", "iPhone", {"fields": [STORAGE, F("battery_health", "صحة البطارية", "Battery health", "number", unit_ar="%", unit_en="%", min_value=0, max_value=100, is_filterable=False)]}),
    ("phones-android", "هواتف أندرويد", "Android phones", {"fields": [
        F("brand", "الماركة", "Brand", "select", options=o(("samsung", "سامسونج", "Samsung"), ("huawei", "هواوي", "Huawei"), ("xiaomi", "شاومي", "Xiaomi"), ("google", "جوجل", "Google"), ("oppo", "أوبو", "Oppo"), ("other", "أخرى", "Other"))), STORAGE]}),
    ("phone-numbers", "أرقام هواتف مميزة", "Special numbers", {}),
    ("tablets", "أجهزة لوحية", "Tablets", {"fields": [F("brand", "الماركة", "Brand", "text")]}),
    ("computers", "لابتوب وكمبيوتر", "Laptops & PCs", {"fields": [F("brand", "الماركة", "Brand", "text")]}),
    ("gaming", "ألعاب الفيديو", "Video games", {"fields": [F("platform", "المنصة", "Platform", "select", options=o(("playstation", "بلايستيشن", "PlayStation"), ("xbox", "إكس بوكس", "Xbox"), ("nintendo", "نينتندو", "Nintendo"), ("pc", "كمبيوتر", "PC")))]}),
    ("tv-audio", "تلفزيونات وصوتيات", "TV & audio", {"fields": [F("brand", "الماركة", "Brand", "text")]}),
    ("cameras", "كاميرات", "Cameras", {"fields": [F("brand", "الماركة", "Brand", "text")]}),
    ("smartwatches", "ساعات ذكية", "Smart watches", {}),
    ("electronics-accessories", "إكسسوارات", "Accessories", {}),
  ]),
  ("home", "الأثاث والمنزل", "Furniture & home", "sofa", "price", True, [], [
    ("furn-bedroom", "غرف نوم", "Bedrooms", {}), ("furn-living", "صالات وكنب", "Living & sofas", {}),
    ("furn-dining", "طاولات وكراسي", "Tables & chairs", {}), ("furn-kitchen", "مطابخ", "Kitchens", {}),
    ("furn-office", "أثاث مكتبي", "Office furniture", {}), ("furn-outdoor", "أثاث خارجي", "Outdoor", {}),
    ("furn-decor", "ديكور وسجاد", "Decor & rugs", {}),
    ("app-ac", "مكيفات", "Air conditioners", {"fields": [F("brand", "الماركة", "Brand", "text")]}),
    ("appliances", "أجهزة منزلية", "Home appliances", {"fields": [F("brand", "الماركة", "Brand", "text")]}),
  ]),
  ("animals", "الحيوانات والطيور", "Animals & birds", "paw", "price", False,
    [F("age", "العمر", "Age", "text", is_filterable=False), GENDER, F("vaccinated", "مُطعّم", "Vaccinated", "select", options=YES_NO)], [
    ("animals-birds", "طيور", "Birds", {}), ("animals-cats", "قطط", "Cats", {}), ("animals-dogs", "كلاب", "Dogs", {}),
    ("animals-fish", "أسماك وأحواض", "Fish & aquariums", {}), ("animals-horses", "خيول", "Horses", {}),
    ("animals-other", "حيوانات أليفة أخرى", "Other pets", {}), ("animals-supplies", "مستلزمات الحيوانات", "Pet supplies", {}),
  ]),
  ("livestock", "المواشي والأغنام", "Livestock & sheep", "sheep", "price", False,
    [F("breed", "السلالة", "Breed", "text"), F("age", "العمر", "Age", "text", is_filterable=False), GENDER,
     F("head_count", "العدد", "Head count", "number", min_value=1, max_value=10000)], [
    ("livestock-sheep", "أغنام", "Sheep", {}), ("livestock-goats", "ماعز", "Goats", {}), ("livestock-camels", "إبل", "Camels", {}),
    ("livestock-cattle", "أبقار", "Cattle", {}), ("livestock-poultry", "دواجن", "Poultry", {}),
    ("livestock-feed", "أعلاف ومستلزمات", "Feed & supplies", {}),
  ]),
  ("camping", "الرحلات والتخييم", "Trips & camping", "tent", "price", True, [], [
    ("camp-tents", "خيام ومخيمات", "Tents & camps", {}), ("camp-gear", "معدات تخييم", "Camping gear", {}),
    ("camp-caravans", "كرفانات", "Caravans", {}), ("camp-fishing", "صيد ومعدات بحرية", "Fishing & marine", {}),
    ("camp-trips", "رحلات وتأجير", "Trips & rentals", {"price_label": "rent"}),
  ]),
  ("fashion", "الأزياء والإكسسوارات", "Fashion & accessories", "hanger", "price", True,
    [F("brand", "الماركة", "Brand", "text")], [
    ("fashion-men", "ملابس رجالية", "Men", {"fields": [F("size", "المقاس", "Size", "text", is_filterable=False)]}),
    ("fashion-women", "ملابس نسائية", "Women", {"fields": [F("size", "المقاس", "Size", "text", is_filterable=False)]}),
    ("fashion-kids", "ملابس أطفال", "Kids", {}), ("fashion-shoes", "أحذية", "Shoes", {}), ("fashion-bags", "حقائب", "Bags", {}),
    ("fashion-watches", "ساعات", "Watches", {}), ("fashion-jewelry", "ذهب ومجوهرات", "Gold & jewelry", {}),
    ("fashion-perfume", "عطور", "Perfumes", {}), ("fashion-eyewear", "نظارات", "Eyewear", {}),
  ]),
  ("jobs", "الوظائف", "Jobs", "briefcase", "salary", False, [
    F("job_type", "نوع الدوام", "Job type", "select", options=o(("full_time", "دوام كامل", "Full time"), ("part_time", "دوام جزئي", "Part time"), ("freelance", "عمل حر", "Freelance"), ("remote", "عن بعد", "Remote"))),
    F("experience", "الخبرة", "Experience", "select", options=o(("0", "بدون خبرة", "No experience"), ("1", "1-2 سنة", "1-2 years"), ("3", "3-5 سنوات", "3-5 years"), ("6", "أكثر من 5", "5+ years"))),
    F("sector", "المجال", "Sector", "text"),
  ], [("jobs-vacancies", "وظائف شاغرة", "Vacancies", {}), ("jobs-seekers", "باحثون عن عمل", "Job seekers", {})]),
  ("services", "الخدمات", "Services", "wrench", "price", False, [], [
    ("srv-moving", "نقل عفش", "Moving", {}), ("srv-cleaning", "تنظيف", "Cleaning", {}), ("srv-home", "صيانة منزلية", "Home maintenance", {}),
    ("srv-car", "خدمات سيارات", "Car services", {}), ("srv-tutoring", "دروس خصوصية", "Tutoring", {}),
    ("srv-design", "تصميم وبرمجة", "Design & development", {}), ("srv-photo", "تصوير", "Photography", {}),
    ("srv-events", "حفلات ومناسبات", "Events", {}), ("srv-other", "خدمات أخرى", "Other services", {}),
  ]),
  ("equipment", "المعدات والآليات", "Equipment & machinery", "excavator", "price", True,
    [YEAR(), F("brand", "الماركة", "Brand", "text")], [
    ("equip-heavy", "معدات ثقيلة", "Heavy equipment", {}), ("equip-cranes", "رافعات", "Cranes & lifts", {}),
    ("equip-generators", "مولدات", "Generators", {}), ("equip-industrial", "معدات صناعية", "Industrial", {}),
    ("equip-restaurant", "معدات مطاعم ومحلات", "Restaurant & shop equipment", {}), ("equip-tools", "عدد وأدوات", "Tools", {}),
  ]),
  ("misc", "إعلانات متنوعة", "Miscellaneous", "grid", "price", True, [], [
    ("misc-sports", "رياضة ولياقة", "Sports & fitness", {}), ("misc-kids", "مستلزمات أطفال", "Kids & baby", {}),
    ("misc-books", "كتب ومجلات", "Books", {}), ("misc-collectibles", "تحف ومقتنيات", "Antiques & collectibles", {}),
    ("misc-music", "آلات موسيقية", "Musical instruments", {}), ("misc-business", "مشاريع للبيع", "Businesses for sale", {}),
    ("misc-other", "أخرى", "Other", {}),
  ]),
]

def main():
    mains, subs, fields = [], [], []
    for i, (slug, ar, en, icon, pl, cond, mfields, subl) in enumerate(TREE):
        mains.append([slug, ar, en, icon, pl, cond, i])
        for j, f in enumerate(mfields):
            fields.append([slug, f, j])
        for j, (sslug, sar, sen, extra) in enumerate(subl):
            subs.append([slug, sslug, sar, sen, extra.get("price_label", pl), j])
            for k, f in enumerate(extra.get("fields", [])):
                fields.append([sslug, f, 10 + k])
    J = lambda x: "'" + json.dumps(x, ensure_ascii=False, separators=(",", ":")).replace("'", "''") + "'"
    frows = [[c, f["key"], f["label_ar"], f["label_en"], f["type"], f.get("options", []), f.get("unit_ar"), f.get("unit_en"),
              f.get("min_value"), f.get("max_value"), f.get("is_required", False), f.get("is_filterable", True), s] for c, f, s in fields]
    sql = f"""-- FIKRA SELL · 0015 · Category tree v2: 12 main sections (generated by supabase/seed/categories_v2.py)
-- Replaces the reference category tree. Refuses to run once ads exist, so no
-- live listing can ever be orphaned.
do $$ begin
  if exists (select 1 from public.ads) or exists (select 1 from public.banners where category_id is not null) then
    raise exception 'category tree v2 must be applied before any ads exist';
  end if;
end $$;

delete from public.category_fields;
delete from public.categories;

insert into public.categories (slug, name_ar, name_en, icon, price_label, has_condition, sort)
select r->>0, r->>1, r->>2, r->>3, r->>4, (r->>5)::boolean, (r->>6)::int from jsonb_array_elements({J(mains)}::jsonb) r;

insert into public.categories (parent_id, slug, name_ar, name_en, icon, price_label, has_condition, sort)
select p.id, r->>1, r->>2, r->>3, p.icon, r->>4, p.has_condition, (r->>5)::int
from jsonb_array_elements({J(subs)}::jsonb) r join public.categories p on p.slug = r->>0;

insert into public.category_fields (category_id, key, label_ar, label_en, type, options, unit_ar, unit_en, min_value, max_value, is_required, is_filterable, sort)
select c.id, r->>1, r->>2, r->>3, (r->>4)::public.field_type, r->5, r->>6, r->>7, (r->>8)::numeric, (r->>9)::numeric,
       (r->>10)::boolean, (r->>11)::boolean, (r->>12)::int
from jsonb_array_elements({J(frows)}::jsonb) r join public.categories c on c.slug = r->>0;
"""
    OUT.write_text(sql, encoding="utf8")
    print(f"wrote {OUT.name}: {len(mains)} mains, {len(subs)} subs, {len(frows)} fields, {len(sql)} bytes")

if __name__ == "__main__":
    main()
