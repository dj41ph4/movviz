#!/usr/bin/env python3
import configparser
import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

RESERVED_PORTS = {22, 80, 443, 445, 3306, 5050, 5432, 6379, 8181, 8443}
VALID_CATEGORIES = {
    "Audio_Video_Entertainment",
    "Photography_Video",
    "Backup_Sync",
    "Development_Tools",
    "Utilities",
    "Web_Services",
    "Security",
    "Download",
    "Driver",
    "Artificial_Intelligence",
}
REQUIRED_LANGUAGES = [
    "zh-cn", "zh-hk", "en-us", "fr-fr", "de-de", "it-it", "es-es",
    "hu-hu", "ja-jp", "ko-kr", "pl-pl", "ru-ru", "tr-tr", "pt-pt",
    "cs-cz", "da-dk", "nl-nl", "nb-no", "sv-se", "el-gr", "ro-ro",
    "th-th", "vi-vn", "id-id", "ar-sa", "he-il",
]
REQUIRED_PACKAGE_FILES = {"config.ini", "movviz.lang", "movviz.svg", "docker-compose.yml"}


def fail(message: str) -> None:
    raise SystemExit(f"TerraMaster validation failed: {message}")


def unquote(value: str) -> str:
    value = value.strip()
    if len(value) >= 2 and value[0] == value[-1] == '"':
        return value[1:-1]
    return value


def validate_text_file(path: Path) -> None:
    data = path.read_bytes()
    if data.startswith(b"\xef\xbb\xbf"):
        fail(f"{path.name} contains a UTF-8 BOM")
    if b"\r\n" in data or b"\r" in data:
        fail(f"{path.name} must use LF line endings only")
    try:
        data.decode("utf-8")
    except UnicodeDecodeError as exc:
        fail(f"{path.name} is not valid UTF-8: {exc}")


def validate_config(path: Path, expected_arch: str) -> None:
    try:
        cfg = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        fail(f"config.ini is not valid JSON: {exc}")

    required = ["id", "icon", "publisher", "exec", "version", "help", "category", "platform", "application_type", "user"]
    for key in required:
        if key not in cfg or cfg[key] in (None, "", []):
            fail(f"config.ini missing required field: {key}")

    if cfg["id"] != "movviz":
        fail("config.ini id must be 'movviz'")
    if cfg["icon"] != "/images/icons/movviz.svg":
        fail("config.ini icon path must be /images/icons/movviz.svg")
    if cfg["publisher"] != "dj41ph4":
        fail("config.ini publisher must be dj41ph4; register the TerraMaster developer account with the same developer name")
    if cfg.get("path") != "http://${ip}:9810" or cfg.get("open_path") is not True:
        fail("Docker Web UI must use open_path=true and http://${ip}:9810")
    if cfg["exec"] is not True:
        fail("config.ini exec must be true")
    if not re.fullmatch(r"\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?", str(cfg["version"])):
        fail(f"unexpected version format: {cfg['version']}")
    categories = cfg["category"]
    if not isinstance(categories, list) or not categories or any(c not in VALID_CATEGORIES for c in categories):
        fail(f"invalid TerraMaster category: {categories}")
    if "DockerEngine" not in cfg.get("depend", []):
        fail("config.ini depend must include DockerEngine")
    relation = cfg.get("relation", [])
    if "docker" not in relation or "DockerEngine" not in relation:
        fail("config.ini relation must include docker and DockerEngine")
    if cfg["platform"] != expected_arch:
        fail(f"config.ini platform {cfg['platform']} does not match {expected_arch}")
    if cfg["application_type"] != "docker":
        fail("application_type must be docker")
    if cfg["user"] != "1000:1000":
        fail("config.ini user must be explicit non-root 1000:1000")
    if cfg.get("compose_project") != "movviz":
        fail("compose_project must be movviz")
    if cfg.get("low_version") != "TOS7.0":
        fail("low_version must be TOS7.0")
    if not str(cfg.get("help", "")).startswith("https://"):
        fail("help must be an HTTPS URL")


def validate_languages(path: Path) -> None:
    parser = configparser.ConfigParser(interpolation=None)
    parser.optionxform = str
    try:
        parser.read(path, encoding="utf-8")
    except configparser.Error as exc:
        fail(f"movviz.lang is invalid: {exc}")

    sections = parser.sections()
    if sections != REQUIRED_LANGUAGES:
        fail(f"language sections must exactly follow the documented 26-language baseline; got {sections}")
    for language in REQUIRED_LANGUAGES:
        for key in ("name", "auth", "descript"):
            if key not in parser[language] or not unquote(parser[language][key]):
                fail(f"{language}.{key} must be non-empty")


def validate_svg(path: Path) -> None:
    if path.stat().st_size > 50 * 1024:
        fail("movviz.svg exceeds TerraMaster's 50 KB limit")
    try:
        root = ET.parse(path).getroot()
    except ET.ParseError as exc:
        fail(f"movviz.svg is invalid XML: {exc}")
    if not root.tag.endswith("svg"):
        fail("movviz.svg root element must be <svg>")
    if not root.attrib.get("viewBox"):
        fail("movviz.svg must define a viewBox")
    style = root.attrib.get("style", "").lower()
    if "background" in style:
        fail("movviz.svg must have a transparent background")
    for element in root.iter():
        if element.tag.endswith("rect"):
            width = element.attrib.get("width")
            height = element.attrib.get("height")
            if width in {"100%", "512"} and height in {"100%", "512"}:
                fail("movviz.svg appears to contain a full-canvas background; TerraMaster requires transparency")


def validate_compose(path: Path) -> None:
    text = path.read_text(encoding="utf-8")
    lowered = text.lower()
    if "privileged:" in lowered:
        fail("privileged mode is prohibited")
    if "network_mode:" in lowered:
        fail("network_mode is prohibited for this application")
    if re.search(r"image:\s*[^\n]*:latest(?:\s|$)", text):
        fail("Docker image must use an immutable tag, never :latest")
    image_match = re.search(r"^\s*image:\s*([^\s]+)\s*$", text, re.MULTILINE)
    if not image_match or not image_match.group(1).startswith("dj41ph4/movviz:sha-"):
        fail("Docker image must be the immutable Docker Hub tag dj41ph4/movviz:sha-<commit>")
    if not re.fullmatch(r"dj41ph4/movviz:sha-[0-9a-f]{40}", image_match.group(1)):
        fail(f"invalid immutable Docker image tag: {image_match.group(1)}")
    if 'user: "1000:1000"' not in text:
        fail("docker-compose.yml must explicitly declare user: 1000:1000")
    if "x-app-meta:" not in text or "port: 9810" not in text or "protocol: http" not in text:
        fail("x-app-meta Web UI metadata is incomplete")
    if "./config:/config" not in text or "./data:/data" not in text:
        fail("/config and /data must use persistent bind mounts")
    if "restart: unless-stopped" not in text:
        fail("restart policy must be unless-stopped")
    if "/api/healthz" not in text:
        fail("healthcheck must target MOVVIZ /api/healthz")

    ports = [int(value) for value in re.findall(r'^\s*-\s*"(\d+):\d+(?:/(?:tcp|udp))?"\s*$', text, re.MULTILINE)]
    if 9810 not in ports:
        fail("Web UI host port 9810 is not mapped")
    forbidden = RESERVED_PORTS.intersection(ports)
    if forbidden:
        fail(f"reserved TOS ports are mapped: {sorted(forbidden)}")
    for port in ports:
        if not (8000 <= port <= 19999 or 49152 <= port <= 65535):
            fail(f"host port {port} is outside TerraMaster recommended/dynamic ranges")

    active_sequence = None
    sequence_indent = None
    for raw in text.splitlines():
        stripped = raw.strip()
        indent = len(raw) - len(raw.lstrip())
        if re.fullmatch(r"(?:ports|volumes):", stripped):
            active_sequence = stripped[:-1]
            sequence_indent = indent
            continue
        if active_sequence is not None:
            if stripped and indent <= sequence_indent:
                active_sequence = None
                sequence_indent = None
            elif stripped.startswith("-") and "#" in raw:
                fail(f"comments are not allowed inside the {active_sequence} sequence")


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("usage: validate.py <package-dir> <x86_64|aarch64>")
    root = Path(sys.argv[1])
    arch = sys.argv[2]
    if arch not in {"x86_64", "aarch64"}:
        fail(f"unsupported architecture: {arch}")
    if not root.is_dir():
        fail(f"package directory does not exist: {root}")
    names = {p.name for p in root.iterdir() if p.is_file()}
    if names != REQUIRED_PACKAGE_FILES:
        fail(f"package directory must contain exactly {sorted(REQUIRED_PACKAGE_FILES)}; got {sorted(names)}")
    for name in REQUIRED_PACKAGE_FILES:
        validate_text_file(root / name)
    validate_config(root / "config.ini", arch)
    validate_languages(root / "movviz.lang")
    validate_svg(root / "movviz.svg")
    validate_compose(root / "docker-compose.yml")
    print(f"TerraMaster validation OK for {arch}")


if __name__ == "__main__":
    main()
