#!/usr/bin/env python3
"""Generates supabase/migrations/20261125000009_seed.sql (reference data only).

Run:  python3 supabase/seed/generate_seed.py
The output contains NO demo users or demo ads — only categories, fields,
Kuwait governorates/areas, settings, packages (inactive) and legal pages.
"""
import json, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "migrations" / "20261125000009_seed.sql"
PAGES = ROOT / "seed" / "pages"

def q(s):
    return "'" + str(s).replace("'", "''") + "'" if s is not None else "null"

def opts(pairs):
    return [{"v": v, "ar": ar, "en": en} for v, ar, en in pairs]

YES_NO = opts([("yes", "نعم", "Yes"), ("no", "لا", "No")])
CAR_MAKES = opts([
    ("toyota", "تويوتا", "Toyota"), ("lexus", "لكزس", "Lexus"), ("nissan", "نيسان", "Nissan"),
    ("infiniti", "إنفينيتي", "Infiniti"), ("mercedes", "مرسيدس", "Mercedes-Benz"), ("bmw", "بي إم دبليو", "BMW"),
    ("audi", "أودي", "Audi"), ("porsche", "بورش", "Porsche"), ("land-rover", "لاند روفر", "Land Rover"),
    ("chevrolet", "شفروليه", "Chevrolet"), ("gmc", "جي إم سي", "GMC"), ("cadillac", "كاديلاك", "Cadillac"),
    ("ford", "فورد", "Ford"), ("lincoln", "لينكون", "Lincoln"), ("dodge", "دودج", "Dodge"), ("jeep", "جيب", "Jeep"),
    ("ram", "رام", "RAM"), ("hyundai", "هيونداي", "Hyundai"), ("kia", "كيا", "Kia"), ("genesis", "جينيسيس", "Genesis"),
    ("honda", "هوندا", "Honda"), ("mazda", "مازدا", "Mazda"), ("mitsubishi", "ميتسوبيشي", "Mitsubishi"),
    ("suzuki", "سوزوكي", "Suzuki"), ("volkswagen", "فولكس واجن", "Volkswagen"), ("volvo", "فولفو", "Volvo"),
    ("mg", "إم جي", "MG"), ("changan", "شانجان", "Changan"), ("geely", "جيلي", "Geely"), ("chery", "شيري", "Chery"),
    ("haval", "هافال", "Haval"), ("tesla", "تسلا", "Tesla"), ("bentley", "بنتلي", "Bentley"),
    ("rolls-royce", "رولز رويس", "Rolls-Royce"), ("ferrari", "فيراري", "Ferrari"), ("lamborghini", "لامبورغيني", "Lamborghini"),
    ("maserati", "مازيراتي", "Maserati"), ("other", "أخرى", "Other")])
BIKE_MAKES = opts([("harley-davidson", "هارلي ديفيدسون", "Harley-Davidson"), ("honda", "هوندا", "Honda"),
    ("yamaha", "ياماها", "Yamaha"), ("kawasaki", "كاواساكي", "Kawasaki"), ("suzuki", "سوزوكي", "Suzuki"),
    ("ducati", "دوكاتي", "Ducati"), ("bmw", "بي إم دبليو", "BMW"), ("ktm", "كي تي إم", "KTM"),
    ("triumph", "ترايمف", "Triumph"), ("polaris", "بولاريس", "Polaris"), ("can-am", "كان آم", "Can-Am"), ("other", "أخرى", "Other")])

F = lambda key, ar, en, typ, **kw: dict(key=key, label_ar=ar, label_en=en, type=typ, **kw)

CATEGORIES = [
  dict(slug="cars", ar="السيارات", en="Cars", icon="car", subs=[
      ("cars-sale", "سيارات للبيع", "Cars for sale"), ("cars-classic", "سيارات كلاسيكية", "Classic cars"),
      ("cars-rent", "سيارات للإيجار", "Cars for rent", "rent"), ("cars-wanted", "مطلوب سيارة", "Wanted cars")],
    fields=[F("make", "الشركة المصنعة", "Make", "select", options=CAR_MAKES, is_required=True),
            F("model", "الموديل", "Model", "text", is_filterable=False),
            F("year", "سنة الصنع", "Year", "year", min_value=1950, max_value=2027, is_required=True),
            F("mileage", "المسافة المقطوعة", "Mileage", "number", unit_ar="كم", unit_en="km", min_value=0, max_value=2000000),
            F("transmission", "ناقل الحركة", "Transmission", "select", options=opts([("automatic", "أوتوماتيك", "Automatic"), ("manual", "يدوي", "Manual")])),
            F("fuel", "نوع الوقود", "Fuel", "select", options=opts([("petrol", "بنزين", "Petrol"), ("diesel", "ديزل", "Diesel"), ("hybrid", "هايبرد", "Hybrid"), ("electric", "كهربائي", "Electric")])),
            F("body", "نوع الهيكل", "Body type", "select", options=opts([("sedan", "سيدان", "Sedan"), ("suv", "دفع رباعي", "SUV"), ("pickup", "بيك أب", "Pickup"), ("coupe", "كوبيه", "Coupe"), ("hatchback", "هاتشباك", "Hatchback"), ("van", "فان", "Van"), ("convertible", "مكشوفة", "Convertible")])),
            F("cylinders", "عدد السلندرات", "Cylinders", "select", is_filterable=False, options=opts([("3", "3", "3"), ("4", "4", "4"), ("6", "6", "6"), ("8", "8", "8"), ("10", "10", "10"), ("12", "12", "12")])),
            F("color", "اللون", "Color", "text", is_filterable=False)]),
  dict(slug="motorcycles", ar="الدراجات النارية", en="Motorcycles", icon="motorcycle", subs=[
      ("bikes-sport", "دراجات رياضية", "Sport bikes"), ("bikes-cruiser", "كروزر", "Cruisers"),
      ("bikes-atv", "بقيات ودبابات", "ATVs & buggies"), ("bikes-scooter", "سكوترات", "Scooters"),
      ("bikes-gear", "ملابس ومعدات الدراجات", "Riding gear")],
    fields=[F("make", "الشركة المصنعة", "Make", "select", options=BIKE_MAKES),
            F("year", "سنة الصنع", "Year", "year", min_value=1950, max_value=2027),
            F("mileage", "المسافة المقطوعة", "Mileage", "number", unit_ar="كم", unit_en="km", min_value=0, max_value=500000),
            F("engine_cc", "سعة المحرك", "Engine size", "number", unit_ar="سي سي", unit_en="cc", min_value=0, max_value=3000)]),
  dict(slug="auto-parts", ar="قطع غيار السيارات", en="Auto parts", icon="gear", subs=[
      ("parts-engine", "محركات وقطعها", "Engines & parts"), ("parts-wheels", "جنوط وإطارات", "Wheels & tyres"),
      ("parts-body", "بودي وهيكل", "Body parts"), ("parts-electric", "كهرباء وإلكترونيات", "Electrical"),
      ("parts-accessories", "إكسسوارات السيارات", "Car accessories"), ("parts-oils", "زيوت وعناية", "Oils & care")],
    fields=[F("compatible_make", "متوافق مع", "Fits make", "select", options=CAR_MAKES),
            F("part_number", "رقم القطعة", "Part number", "text", is_filterable=False)]),
  dict(slug="real-estate", ar="العقارات", en="Real estate", icon="building", has_condition=False, subs=[
      ("re-apartments-rent", "شقق للإيجار", "Apartments for rent", "rent"), ("re-apartments-sale", "شقق للبيع", "Apartments for sale"),
      ("re-houses-sale", "بيوت للبيع", "Houses for sale"), ("re-houses-rent", "بيوت للإيجار", "Houses for rent", "rent"),
      ("re-land", "أراضي للبيع", "Land for sale"), ("re-chalets", "شاليهات", "Chalets"),
      ("re-commercial", "محلات ومكاتب", "Shops & offices"), ("re-abroad", "عقارات خارج الكويت", "Property abroad")],
    fields=[F("area_sqm", "المساحة", "Area", "number", unit_ar="م²", unit_en="m²", min_value=1, max_value=1000000),
            F("bedrooms", "عدد الغرف", "Bedrooms", "select", options=opts([("0", "استوديو", "Studio"), ("1", "1", "1"), ("2", "2", "2"), ("3", "3", "3"), ("4", "4", "4"), ("5", "5", "5"), ("6", "6", "6"), ("7", "7+", "7+")])),
            F("bathrooms", "عدد الحمامات", "Bathrooms", "select", options=opts([("1", "1", "1"), ("2", "2", "2"), ("3", "3", "3"), ("4", "4", "4"), ("5", "5+", "5+")])),
            F("furnished", "التأثيث", "Furnishing", "select", options=opts([("furnished", "مفروش", "Furnished"), ("semi", "شبه مفروش", "Semi-furnished"), ("unfurnished", "غير مفروش", "Unfurnished")])),
            F("floor", "الدور", "Floor", "number", is_filterable=False, min_value=-2, max_value=100)]),
  dict(slug="phones", ar="الهواتف", en="Phones", icon="phone", subs=[
      ("phones-iphone", "آيفون", "iPhone"), ("phones-samsung", "سامسونج", "Samsung"), ("phones-huawei", "هواوي", "Huawei"),
      ("phones-xiaomi", "شاومي", "Xiaomi"), ("phones-other", "هواتف أخرى", "Other phones"),
      ("phones-numbers", "أرقام مميزة", "Special numbers"), ("phones-accessories", "إكسسوارات الهواتف", "Phone accessories")],
    fields=[F("storage", "سعة التخزين", "Storage", "select", options=opts([("64", "64GB", "64GB"), ("128", "128GB", "128GB"), ("256", "256GB", "256GB"), ("512", "512GB", "512GB"), ("1024", "1TB", "1TB")])),
            F("battery_health", "صحة البطارية", "Battery health", "number", unit_ar="%", unit_en="%", min_value=0, max_value=100, is_filterable=False),
            F("warranty", "عليه ضمان", "Under warranty", "select", options=YES_NO)]),
  dict(slug="electronics", ar="الإلكترونيات", en="Electronics", icon="tv", subs=[
      ("elec-tv", "تلفزيونات", "TVs"), ("elec-audio", "صوتيات وسماعات", "Audio"), ("elec-cameras", "كاميرات", "Cameras"),
      ("elec-tablets", "أجهزة لوحية", "Tablets"), ("elec-wearables", "ساعات ذكية", "Smart watches"), ("elec-other", "إلكترونيات أخرى", "Other electronics")],
    fields=[F("brand", "الماركة", "Brand", "text")]),
  dict(slug="computers-gaming", ar="الكمبيوتر والألعاب", en="Computers & gaming", icon="gamepad", subs=[
      ("comp-laptops", "لابتوب", "Laptops"), ("comp-desktops", "كمبيوتر مكتبي", "Desktops"), ("comp-parts", "قطع وملحقات", "Parts & peripherals"),
      ("game-playstation", "بلايستيشن", "PlayStation"), ("game-xbox", "إكس بوكس", "Xbox"), ("game-nintendo", "نينتندو", "Nintendo"),
      ("game-titles", "ألعاب فيديو", "Video games")],
    fields=[F("brand", "الماركة", "Brand", "text")]),
  dict(slug="furniture", ar="الأثاث", en="Furniture", icon="sofa", subs=[
      ("furn-bedroom", "غرف نوم", "Bedrooms"), ("furn-living", "صالات وكنب", "Living & sofas"), ("furn-dining", "طاولات وكراسي", "Tables & chairs"),
      ("furn-kitchen", "مطابخ", "Kitchens"), ("furn-office", "أثاث مكتبي", "Office furniture"), ("furn-outdoor", "أثاث خارجي", "Outdoor"),
      ("furn-decor", "ديكور وسجاد", "Decor & rugs")], fields=[]),
  dict(slug="appliances", ar="الأجهزة المنزلية", en="Home appliances", icon="appliance", subs=[
      ("app-ac", "مكيفات", "Air conditioners"), ("app-fridges", "ثلاجات وفريزرات", "Fridges & freezers"), ("app-washers", "غسالات ونشافات", "Washers & dryers"),
      ("app-cooking", "أفران وطباخات", "Ovens & cookers"), ("app-small", "أجهزة مطبخ صغيرة", "Small kitchen appliances"), ("app-cleaning", "مكانس وأجهزة تنظيف", "Cleaning")],
    fields=[F("brand", "الماركة", "Brand", "text")]),
  dict(slug="watches-jewelry", ar="الساعات والمجوهرات", en="Watches & jewelry", icon="watch", subs=[
      ("watch-men", "ساعات رجالية", "Men's watches"), ("watch-women", "ساعات نسائية", "Women's watches"), ("jewel-gold", "ذهب", "Gold"),
      ("jewel-diamond", "ألماس", "Diamonds"), ("jewel-silver", "فضة وإكسسوارات", "Silver & accessories")],
    fields=[F("brand", "الماركة", "Brand", "text")]),
  dict(slug="fashion", ar="الأزياء والإكسسوارات", en="Fashion & accessories", icon="hanger", subs=[
      ("fashion-men", "ملابس رجالية", "Men"), ("fashion-women", "ملابس نسائية", "Women"), ("fashion-kids", "ملابس أطفال", "Kids"),
      ("fashion-shoes", "أحذية", "Shoes"), ("fashion-bags", "حقائب", "Bags"), ("fashion-perfume", "عطور", "Perfumes"),
      ("fashion-eyewear", "نظارات", "Eyewear")],
    fields=[F("size", "المقاس", "Size", "text", is_filterable=False), F("brand", "الماركة", "Brand", "text")]),
  dict(slug="animals", ar="الحيوانات", en="Animals", icon="paw", has_condition=False, subs=[
      ("animals-cats", "قطط", "Cats"), ("animals-birds", "طيور", "Birds"), ("animals-fish", "أسماك وأحواض", "Fish & aquariums"),
      ("animals-horses", "خيول", "Horses"), ("animals-livestock", "أغنام وماشية", "Livestock"),
      ("animals-other", "حيوانات أليفة أخرى", "Other pets"), ("animals-supplies", "مستلزمات الحيوانات", "Pet supplies")],
    fields=[F("age", "العمر", "Age", "text", is_filterable=False),
            F("gender", "الجنس", "Gender", "select", options=opts([("male", "ذكر", "Male"), ("female", "أنثى", "Female"), ("pair", "زوج", "Pair")])),
            F("vaccinated", "مُطعّم", "Vaccinated", "select", options=YES_NO)]),
  dict(slug="equipment", ar="المعدات والآليات", en="Equipment & machinery", icon="excavator", subs=[
      ("equip-heavy", "معدات ثقيلة", "Heavy equipment"), ("equip-trucks", "شاحنات ونقل", "Trucks"), ("equip-cranes", "رافعات", "Cranes & lifts"),
      ("equip-generators", "مولدات", "Generators"), ("equip-industrial", "معدات صناعية", "Industrial"), ("equip-tools", "عدد وأدوات", "Tools")],
    fields=[F("year", "سنة الصنع", "Year", "year", min_value=1950, max_value=2027), F("brand", "الماركة", "Brand", "text")]),
  dict(slug="camping", ar="الرحلات والتخييم", en="Trips & camping", icon="tent", subs=[
      ("camp-tents", "خيام ومخيمات", "Tents & camps"), ("camp-gear", "معدات تخييم", "Camping gear"), ("camp-boats", "قوارب وجت سكي", "Boats & jet skis"),
      ("camp-fishing", "صيد ومعدات بحرية", "Fishing & marine"), ("camp-caravans", "كرفانات", "Caravans"), ("camp-trips", "رحلات وتأجير", "Trips & rentals", "rent")],
    fields=[]),
  dict(slug="jobs", ar="الوظائف", en="Jobs", icon="briefcase", price_label="salary", has_condition=False, subs=[
      ("jobs-vacancies", "وظائف شاغرة", "Vacancies"), ("jobs-seekers", "باحثون عن عمل", "Job seekers")],
    fields=[F("job_type", "نوع الدوام", "Job type", "select", options=opts([("full_time", "دوام كامل", "Full time"), ("part_time", "دوام جزئي", "Part time"), ("freelance", "عمل حر", "Freelance"), ("remote", "عن بعد", "Remote")])),
            F("experience", "الخبرة", "Experience", "select", options=opts([("0", "بدون خبرة", "No experience"), ("1", "1-2 سنة", "1-2 years"), ("3", "3-5 سنوات", "3-5 years"), ("6", "أكثر من 5", "5+ years")])),
            F("sector", "المجال", "Sector", "text")]),
  dict(slug="services", ar="الخدمات", en="Services", icon="wrench", has_condition=False, subs=[
      ("srv-moving", "نقل عفش", "Moving"), ("srv-cleaning", "تنظيف", "Cleaning"), ("srv-home", "صيانة منزلية", "Home maintenance"),
      ("srv-car", "صيانة سيارات", "Car services"), ("srv-tutoring", "دروس خصوصية", "Tutoring"), ("srv-design", "تصميم وبرمجة", "Design & development"),
      ("srv-photo", "تصوير", "Photography"), ("srv-events", "حفلات ومناسبات", "Events"), ("srv-other", "خدمات أخرى", "Other services")],
    fields=[]),
  dict(slug="business", ar="المشاريع التجارية", en="Businesses", icon="store", has_condition=False, subs=[
      ("biz-sale", "مشاريع للبيع", "Businesses for sale"), ("biz-transfer", "محلات للتقبيل", "Shops for takeover"),
      ("biz-partners", "شراكات واستثمار", "Partnerships"), ("biz-equipment", "معدات مطاعم ومحلات", "Shop & restaurant equipment")],
    fields=[]),
  dict(slug="hobbies", ar="الهوايات والمقتنيات", en="Hobbies & collectibles", icon="spark", subs=[
      ("hob-antiques", "تحف وأنتيكات", "Antiques"), ("hob-coins", "عملات وطوابع", "Coins & stamps"), ("hob-books", "كتب", "Books"),
      ("hob-music", "آلات موسيقية", "Musical instruments"), ("hob-sports", "رياضة ولياقة", "Sports & fitness"),
      ("hob-bicycles", "دراجات هوائية", "Bicycles"), ("hob-toys", "ألعاب أطفال", "Toys")], fields=[]),
  dict(slug="misc", ar="إعلانات متنوعة", en="Miscellaneous", icon="grid", subs=[], fields=[]),
]

GOVS = [
  ("capital", "العاصمة", "Capital", 29.3697, 47.9783),
  ("hawalli", "حولي", "Hawalli", 29.3328, 48.0286),
  ("farwaniya", "الفروانية", "Farwaniya", 29.2775, 47.9586),
  ("ahmadi", "الأحمدي", "Ahmadi", 29.0769, 48.0839),
  ("jahra", "الجهراء", "Jahra", 29.3375, 47.6581),
  ("mubarak-alkabeer", "مبارك الكبير", "Mubarak Al-Kabeer", 29.1880, 48.0590),
]
AREAS = {
 "capital": [("مدينة الكويت","Kuwait City"),("شرق","Sharq"),("المرقاب","Mirqab"),("الصالحية","Salhiya"),("دسمان","Dasman"),("بنيد القار","Bneid Al-Qar"),("الدسمة","Dasma"),("الدعية","Daiya"),("المنصورية","Mansouriya"),("عبدالله السالم","Abdullah Al-Salem"),("النزهة","Nuzha"),("الفيحاء","Faiha"),("الشامية","Shamiya"),("الروضة","Rawda"),("العديلية","Adailiya"),("الخالدية","Khaldiya"),("القادسية","Qadsiya"),("كيفان","Kaifan"),("اليرموك","Yarmouk"),("السرة","Surra"),("قرطبة","Qurtuba"),("النهضة","Nahdha"),("غرناطة","Granada"),("الصليبيخات","Sulaibikhat"),("الدوحة","Doha"),("القيروان","Qairawan"),("الشويخ","Shuwaikh"),("الشويخ الصناعية","Shuwaikh Industrial")],
 "hawalli": [("حولي","Hawalli"),("السالمية","Salmiya"),("الجابرية","Jabriya"),("الرميثية","Rumaithiya"),("مشرف","Mishref"),("بيان","Bayan"),("سلوى","Salwa"),("الشعب","Shaab"),("البدع","Bidaa"),("الزهراء","Zahra"),("السلام","Salam"),("الشهداء","Shuhada"),("الصديق","Siddiq"),("حطين","Hitteen"),("مبارك العبدالله","Mubarak Al-Abdullah"),("ميدان حولي","Maidan Hawalli")],
 "farwaniya": [("الفروانية","Farwaniya"),("خيطان","Khaitan"),("جنوب خيطان","South Khaitan"),("جليب الشيوخ","Jleeb Al-Shuyoukh"),("العمرية","Omariya"),("الرابية","Rabia"),("الرحاب","Rehab"),("الأندلس","Andalous"),("اشبيلية","Ishbiliya"),("الرقعي","Riggae"),("العارضية","Ardiya"),("الفردوس","Firdous"),("صباح الناصر","Sabah Al-Nasser"),("عبدالله المبارك","Abdullah Al-Mubarak"),("الضجيج","Dhajeej"),("غرب الجليب","West Jleeb"),("العباسية","Abbasiya")],
 "ahmadi": [("الأحمدي","Ahmadi"),("الفحيحيل","Fahaheel"),("المنقف","Mangaf"),("المهبولة","Mahboula"),("أبو حليفة","Abu Halifa"),("الفنطاس","Fintas"),("العقيلة","Egaila"),("الرقة","Riqqa"),("هدية","Hadiya"),("الصباحية","Sabahiya"),("الظهر","Dhaher"),("جابر العلي","Jaber Al-Ali"),("فهد الأحمد","Fahad Al-Ahmad"),("علي صباح السالم","Ali Sabah Al-Salem"),("صباح الأحمد","Sabah Al-Ahmad"),("الوفرة","Wafra"),("الخيران","Khairan"),("الزور","Zour"),("النويصيب","Nuwaiseeb"),("الشعيبة","Shuaiba"),("ميناء عبدالله","Mina Abdullah")],
 "jahra": [("الجهراء","Jahra"),("القصر","Qasr"),("النعيم","Naeem"),("النسيم","Naseem"),("الواحة","Waha"),("العيون","Oyoun"),("تيماء","Taima"),("سعد العبدالله","Saad Al-Abdullah"),("أمغرة","Amghara"),("الصليبية","Sulaibiya"),("كبد","Kabd"),("المطلاع","Mutlaa"),("العبدلي","Abdali"),("الجهراء الصناعية","Jahra Industrial")],
 "mubarak-alkabeer": [("مبارك الكبير","Mubarak Al-Kabeer"),("القرين","Qurain"),("القصور","Qusour"),("العدان","Adan"),("صباح السالم","Sabah Al-Salem"),("المسيلة","Messila"),("أبو فطيرة","Abu Fatira"),("أبو الحصانية","Abu Al-Hasaniya"),("الفنيطيس","Fnaitees"),("المسايل","Masayel"),("صبحان","Subhan")],
}

SETTINGS = [
  ("require_ad_review", False, "مراجعة الإعلانات قبل نشرها"),
  ("ad_duration_days", 30, "مدة الإعلان بالأيام"),
  ("max_images", 15, "أقصى عدد صور للإعلان"),
  ("daily_ad_limit", 10, "الحد اليومي للإعلانات لكل حساب"),
  ("new_account_daily_ad_limit", 3, "الحد اليومي للحسابات الجديدة (أول 24 ساعة)"),
  ("bump_cooldown_hours", 24, "الفترة بين كل رفع مجاني للإعلان (ساعات)"),
  ("auto_hide_report_threshold", 5, "عدد البلاغات لإخفاء الإعلان تلقائياً للمراجعة"),
  ("payments_enabled", False, "تفعيل المدفوعات (لا تفعّل قبل ربط بوابة دفع)"),
  ("featured_section_enabled", True, "إظهار قسم الإعلانات المميزة"),
  ("maintenance_mode", False, "وضع الصيانة"),
  ("min_app_version", "1.0.0", "أقل إصدار مسموح للتطبيق"),
  ("support_email", "", "بريد الدعم الفني (يظهر في صفحة الدعم)"),
  ("support_whatsapp", "", "رقم واتساب الدعم (اختياري)"),
]

PACKAGES = [
  ("feature", "إعلان مميز", "Featured ad", "يظهر إعلانك في قسم المميز بالصفحة الرئيسية وبإطار خاص", "Shown in the featured section with a distinct frame", 3.000, 7, None, None, 1),
  ("pin", "تثبيت بالأعلى", "Pin to top", "يبقى إعلانك أول القائمة في قسمه", "Stays first in its category", 2.000, 3, None, None, 2),
  ("bump", "رفع فوري", "Instant bump", "رفع الإعلان للأعلى فوراً دون انتظار", "Move your ad to the top right away", 0.500, 1, None, None, 3),
  ("merchant", "باقة التاجر", "Merchant plan", "شارة تاجر، 100 إعلان شهرياً و30 رفعة", "Merchant badge, 100 ads and 30 bumps per month", 25.000, 30, 100, 30, 4),
  ("subscription", "اشتراك بلس", "Plus subscription", "20 إعلاناً شهرياً و10 رفعات", "20 ads and 10 bumps per month", 5.000, 30, 20, 10, 5),
]

def main():
    L = ["-- FIKRA SELL · 0009 · Reference data (generated by supabase/seed/generate_seed.py — do not edit by hand)",
         "-- Contains no demo users or demo ads."]
    for k, v, d in SETTINGS:
        pub = "false" if k in () else "true"
        L.append(f"insert into public.app_settings (key, value, is_public, description) values ({q(k)}, {q(json.dumps(v))}::jsonb, {pub}, {q(d)}) on conflict (key) do nothing;")
    for i, (slug, ar, en, lat, lng) in enumerate(GOVS):
        L.append(f"insert into public.governorates (slug, name_ar, name_en, lat, lng, sort) values ({q(slug)}, {q(ar)}, {q(en)}, {lat}, {lng}, {i});")
    for slug, areas in AREAS.items():
        for i, (ar, en) in enumerate(areas):
            L.append(f"insert into public.areas (governorate_id, name_ar, name_en, sort) select id, {q(ar)}, {q(en)}, {i} from public.governorates where slug = {q(slug)};")
    for i, c in enumerate(CATEGORIES):
        L.append(f"insert into public.categories (slug, name_ar, name_en, icon, price_label, has_condition, sort) values "
                 f"({q(c['slug'])}, {q(c['ar'])}, {q(c['en'])}, {q(c['icon'])}, {q(c.get('price_label', 'price'))}, {str(c.get('has_condition', True)).lower()}, {i});")
        for j, s in enumerate(c["subs"]):
            slug, ar, en = s[:3]
            pl = s[3] if len(s) > 3 else c.get("price_label", "price")
            L.append(f"insert into public.categories (parent_id, slug, name_ar, name_en, icon, price_label, has_condition, sort) "
                     f"select id, {q(slug)}, {q(ar)}, {q(en)}, {q(c['icon'])}, {q(pl)}, {str(c.get('has_condition', True)).lower()}, {j} from public.categories where slug = {q(c['slug'])};")
        for j, f in enumerate(c["fields"]):
            L.append("insert into public.category_fields (category_id, key, label_ar, label_en, type, options, unit_ar, unit_en, min_value, max_value, is_required, is_filterable, sort) "
                     f"select id, {q(f['key'])}, {q(f['label_ar'])}, {q(f['label_en'])}, {q(f['type'])}, {q(json.dumps(f.get('options', []), ensure_ascii=False))}::jsonb, "
                     f"{q(f.get('unit_ar'))}, {q(f.get('unit_en'))}, {f.get('min_value', 'null')}, {f.get('max_value', 'null')}, "
                     f"{str(f.get('is_required', False)).lower()}, {str(f.get('is_filterable', True)).lower()}, {j} from public.categories where slug = {q(c['slug'])};")
    for kind, nar, nen, dar, den, price, days, ads, bumps, sort in PACKAGES:
        L.append("insert into public.packages (kind, name_ar, name_en, description_ar, description_en, price_kwd, duration_days, ads_quota, bumps_quota, is_active, sort) "
                 f"values ({q(kind)}, {q(nar)}, {q(nen)}, {q(dar)}, {q(den)}, {price}, {days}, {ads if ads else 'null'}, {bumps if bumps is not None else 'null'}, false, {sort});")
    for slug, tar, ten in [("privacy", "سياسة الخصوصية", "Privacy Policy"), ("terms", "شروط الاستخدام", "Terms of Use"),
                           ("guidelines", "إرشادات المجتمع", "Community Guidelines")]:
        ar = (PAGES / f"{slug}.ar.md").read_text(encoding="utf8").strip()
        en = (PAGES / f"{slug}.en.md").read_text(encoding="utf8").strip()
        L.append(f"insert into public.pages (slug, title_ar, title_en, body_ar, body_en) values ({q(slug)}, {q(tar)}, {q(ten)}, {q(ar)}, {q(en)}) on conflict (slug) do nothing;")
    OUT.write_text("\n".join(L) + "\n", encoding="utf8")
    print(f"wrote {OUT} ({len(L)} statements)")

if __name__ == "__main__":
    main()
