"""يولّد أيقونات «ماتعطل» من الخط Tajawal بهوية التطبيق (أزرق + نقطة صفراء).

التشغيل:  python3 scripts/generate-icons.py   (من مجلد mobile، يتطلب Pillow مع libraqm)
المخرجات في assets/: icon.png (iOS، بلا شفافية)، أيقونات Android المتكيفة، شاشة البداية، favicon.
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, features

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
FONT = ROOT / "node_modules/@expo-google-fonts/tajawal/800ExtraBold/Tajawal_800ExtraBold.ttf"
TOP, BOTTOM = (10, 99, 234), (0, 54, 156)  # #0A63EA → #00369C
YELLOW = (255, 196, 0, 255)
WHITE = (255, 255, 255, 255)
WORD = "ماتعطل"

assert features.check("raqm"), "Pillow needs libraqm for Arabic shaping"


def gradient(size: int) -> Image.Image:
    img = Image.new("RGB", (size, size))
    d = ImageDraw.Draw(img)
    for y in range(size):
        t = y / (size - 1)
        d.line([(0, y), (size, y)], fill=tuple(round(a + (b - a) * t) for a, b in zip(TOP, BOTTOM)))
    return img


def logo(size: int, max_width: float, color=WHITE, dot=YELLOW) -> Image.Image:
    """الكلمة مع النقطة الصفراء على يسارها (نهاية الكلمة في RTL)، متمركزة على خلفية شفافة."""
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(canvas)
    fs = size
    while True:
        font = ImageFont.truetype(str(FONT), fs)
        l, t, r, b = d.textbbox((0, 0), WORD, font=font, direction="rtl", language="ar")
        w, h = r - l, b - t
        dot_r = round(fs * 0.075)
        gap = round(fs * 0.06)
        total = w + gap + 2 * dot_r
        if total <= size * max_width:
            break
        fs -= 4
    x0 = (size - total) / 2 + 2 * dot_r + gap  # النص على اليمين
    y0 = (size - h) / 2
    d.text((x0 - l, y0 - t), WORD, font=font, fill=color, direction="rtl", language="ar")
    if dot:
        cx, cy = (size - total) / 2 + dot_r, y0 + h * 0.72
        d.ellipse([cx - dot_r, cy - dot_r, cx + dot_r, cy + dot_r], fill=dot)
    return canvas


def main() -> None:
    S = 1024
    # iOS / عام: بلا شفافية (Apple ترفض الأيقونات ذات قناة ألفا)
    icon = gradient(S)
    icon.paste(logo(S, 0.80), (0, 0), logo(S, 0.80))
    icon.convert("RGB").save(ASSETS / "icon.png", optimize=True)

    # Android المتكيفة: المحتوى داخل المنطقة الآمنة (~66% من الوسط)
    gradient(S).save(ASSETS / "android-icon-background.png", optimize=True)
    logo(S, 0.56).save(ASSETS / "android-icon-foreground.png", optimize=True)
    logo(S, 0.56, color=WHITE, dot=WHITE).save(ASSETS / "android-icon-monochrome.png", optimize=True)

    # شاشة البداية: الشعار الأبيض على خلفية الهوية (اللون من app.json)
    logo(S, 0.90).save(ASSETS / "splash-icon.png", optimize=True)

    # favicon للويب
    fav = gradient(256)
    lg = logo(256, 0.84)
    fav.paste(lg, (0, 0), lg)
    fav.convert("RGB").resize((48, 48), Image.LANCZOS).save(ASSETS / "favicon.png", optimize=True)
    print("icons generated in", ASSETS)


if __name__ == "__main__":
    main()
