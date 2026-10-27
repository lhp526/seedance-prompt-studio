from __future__ import annotations

import json
import re
import shutil
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT.parent / "_deploy_seedance_prompts_20261028"
DATA_FILE = ROOT / "assets" / "js" / "prompts.js"
JSON_FILE = ROOT / "assets" / "data" / "prompts.json"
IMAGES_OUT = ROOT / "assets" / "images"

TYPE_MAP = {
    "首屏": ("精选", "Featured"),
    "用户作品": ("用户作品", "User Works"),
    "Reference Generation": ("参考生成", "Reference Generation"),
    "Video Editing": ("视频编辑", "Video Editing"),
}
SCENE_MAP = {
    "影视": ("影视", "Film"),
    "广告宣传": ("广告", "Advertising"),
    "视觉特效": ("视效", "VFX"),
    "后期特效": ("后期", "Post-production"),
    "游戏": ("游戏", "Gaming"),
    "科普": ("科普", "Explainer"),
}
LABEL_MAP = {
    "来源": "source",
    "分类": "category",
    "场景": "scene",
    "画幅比例": "aspect",
    "参考素材": "references",
    "输入视频": "inputVideo",
    "Source": "source",
    "Category": "category",
    "Scenario": "scene",
    "Aspect Ratio": "aspect",
    "Reference Inputs": "references",
    "Input Video": "inputVideo",
}


def slugify(value: str) -> str:
    value = value.lower().replace("&", "and")
    value = re.sub(r"[^a-z0-9]+", "-", value).strip("-")
    return value or "prompt"


def get_link(value: str) -> str:
    match = re.search(r"\[[^\]]+\]\((https?://[^)]+)\)", value)
    return match.group(1) if match else ""


def parse_language(path: Path, marker: str, is_zh: bool) -> dict[int, dict]:
    text = path.read_text(encoding="utf-8")
    section = text.split(marker, 1)[1]
    chunks = re.split(r"^### No\. (\d+): (.+)$", section, flags=re.MULTILINE)
    prompts: dict[int, dict] = {}

    for index in range(1, len(chunks), 3):
        number = int(chunks[index])
        title = chunks[index + 1].strip()
        body = chunks[index + 2]

        desc_match = re.search(
            r"#### 📖 (?:描述|Description)\s*\n(.*?)(?=\n#### )", body, re.DOTALL
        )
        prompt_match = re.search(r"```[^\n]*\n(.*?)\n```", body, re.DOTALL)
        image_match = re.search(r'<img src="([^"]+)"', body)
        details_match = re.search(
            r"#### 📌 (?:详情|Details)\s*\n(.*?)(?=\n---|\n### |\Z)",
            body,
            re.DOTALL,
        )

        if not prompt_match:
            raise ValueError(f"Prompt {number} in {path.name} has no fenced prompt block")

        bullets = {}
        if details_match:
            for key, value in re.findall(
                r"^- \*\*(.+?):\*\*\s*(.+)$", details_match.group(1), re.MULTILINE
            ):
                canonical = LABEL_MAP.get(key, key)
                bullets[canonical] = value.strip()

        prompts[number] = {
            "title": title,
            "description": desc_match.group(1).strip() if desc_match else "",
            "prompt": prompt_match.group(1).strip(),
            "image": image_match.group(1) if image_match else "",
            "source": bullets.get("source", ""),
            "sourceUrl": get_link(bullets.get("source", "")),
            "category": bullets.get("category", ""),
            "scene": bullets.get("scene", ""),
            "aspect": bullets.get("aspect", ""),
            "references": bullets.get("references", ""),
            "inputVideo": get_link(bullets.get("inputVideo", "")),
            "language": "zh" if is_zh else "en",
        }

    return prompts


def main() -> None:
    zh = parse_language(SOURCE / "README_zh.md", "## 🎬 所有提示词", True)
    en = parse_language(SOURCE / "README.md", "## 🎬 All Prompts", False)

    if set(zh) != set(en):
        raise ValueError(f"Language prompt numbers differ: zh={sorted(zh)} en={sorted(en)}")

    JSON_FILE.parent.mkdir(parents=True, exist_ok=True)
    IMAGES_OUT.mkdir(parents=True, exist_ok=True)

    output = []
    for number in sorted(zh):
        z = zh[number]
        e = en[number]
        category_zh, category_en = TYPE_MAP.get(
            z["category"], (z["category"] or "提示词", e["category"] or "Prompt")
        )
        scene_zh, scene_en = SCENE_MAP.get(
            z["scene"], (z["scene"], e["scene"])
        ) if z["scene"] else ("", "")

        tags_zh = []
        tags_en = []
        if number <= 3:
            tags_zh.append("精选")
            tags_en.append("Featured")
        if scene_zh:
            tags_zh.append(scene_zh)
            tags_en.append(scene_en)
        if category_zh in ("参考生成", "视频编辑"):
            tags_zh.append(category_zh)
            tags_en.append(category_en)

        image_name = Path(z["image"]).name
        source_image = SOURCE / z["image"]
        if not source_image.exists():
            raise FileNotFoundError(source_image)
        shutil.copy2(source_image, IMAGES_OUT / image_name)

        refs = int(z["references"]) if str(z["references"]).isdigit() else 0
        output.append(
            {
                "id": number,
                "slug": slugify(e["title"]),
                "title": {"zh": z["title"], "en": e["title"]},
                "description": {"zh": z["description"], "en": e["description"]},
                "prompt": {"zh": z["prompt"], "en": e["prompt"]},
                "image": f"assets/images/{image_name}",
                "category": {"zh": category_zh, "en": category_en},
                "scene": {"zh": scene_zh, "en": scene_en},
                "aspect": z["aspect"] or e["aspect"] or "",
                "references": refs,
                "inputVideo": z["inputVideo"] or e["inputVideo"],
                "source": z["sourceUrl"] or e["sourceUrl"],
                "sourceLabel": "火山方舟 Seedance 2.5 推广页面" if number <= 3 else "Seedance 2.5 案例",
                "tags": {"zh": tags_zh, "en": tags_en},
                "featured": number <= 3,
                "promptLength": {"zh": len(z["prompt"]), "en": len(e["prompt"])},
            }
        )

    # Keep source labels concise and identical in both languages.
    for item in output:
        item["sourceLabel"] = "Seedance 2.5 / 火山方舟"

    payload = {
        "meta": {
            "title": "Seedance 2.5 Prompt Archive",
            "total": len(output),
            "updatedAt": datetime.now(timezone.utc).isoformat(),
            "upstream": "https://github.com/kinovi-ai/awesome-seedance-2-5-prompts",
            "upstreamCommit": "f5c2a69c23034cb3bdfd948f4c70648bab434637",
            "license": "MIT",
        },
        "prompts": output,
    }

    compact = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    pretty = json.dumps(payload, ensure_ascii=False, indent=2)
    DATA_FILE.write_text(
        "window.SEEDANCE_PROMPTS = " + compact + ";\n", encoding="utf-8"
    )
    JSON_FILE.write_text(pretty + "\n", encoding="utf-8")
    print(f"Generated {len(output)} prompts")
    print(DATA_FILE)
    print(JSON_FILE)


if __name__ == "__main__":
    main()