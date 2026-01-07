import json
import os
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
from datetime import datetime

OPENAI_URL = "https://api.openai.com/v1/chat/completions"


def load_dotenv(path=".env"):
    if not os.path.exists(path):
        return
    with open(path, "r", encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            if key not in os.environ:
                os.environ[key] = value.strip().strip("\"").strip("'")


load_dotenv()

MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
PORT = int(os.getenv("PORT", "8787"))
LOG_PATH = os.getenv("AI_PROXY_LOG", "ai-proxy.log")

SYSTEM_PROMPT = (
    "You are an assistant that tunes a meditation app. "
    "Return JSON only with any of these keys: color (hex), pulseSeconds (number, full cycle), "
    "frequencyHz (number), beatDepthHz (number), volume (0-1), mode (binaural|drift|breath), "
    "intention (short phrase), reply (one short spoken sentence). Use a gentle, grounding bias "
    "(warmer tones, slower pulse, lower volume). If the user mentions breath, prioritize "
    "breath-led choices and mode=breath with slightly deeper inhale/exhale feel. Respond in a "
    "compassionate, spiritual tone inspired by wise, calming guidance, but do not claim to be "
    "any specific religious figure or a literal spirit. Consider yourself an enlightened "
    "meditation specialist and gentle guru who guides the meditator toward peace, inner knowing, "
    "and a felt sense of connection with loved ones and all life. Infer the meditation stage "
    "(settling, deepening, connection, integration) and respond with an appropriate pacing: "
    "slower, softer, and calmer as the session deepens. Offer one subtle suggestion or next step "
    "without waiting for a direct question, plus one simple, soothing question that helps the "
    "user go deeper. Avoid repeating key words from the user's message. Keep replies short, calm, "
    "and reassuring. Omit keys if unsure."
)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        line = f"{self.client_address[0]} - {format % args}"
        with open(LOG_PATH, "a", encoding="utf-8") as handle:
            handle.write(f"{datetime.now().isoformat()} {line}\n")

    def _send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_POST(self):
        if self.path != "/api/suggest":
            self._send_json(404, {"error": "Not found"})
            return

        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length).decode("utf-8") if length else "{}"
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            self._send_json(400, {"error": "Invalid JSON"})
            return

        transcript = str(payload.get("transcript", "")).strip()
        intention = str(payload.get("intention", "")).strip()
        if not transcript:
            self._send_json(400, {"error": "Missing transcript"})
            return

        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            self._send_json(500, {"error": "OPENAI_API_KEY is not set"})
            return

        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    f"Transcript: {transcript}\n"
                    f"Current intention: {intention or 'none'}"
                ),
            },
        ]
        request_body = {
            "model": MODEL,
            "messages": messages,
            "response_format": {"type": "json_object"},
            "temperature": 0.3,
        }

        try:
            request = Request(
                OPENAI_URL,
                data=json.dumps(request_body).encode("utf-8"),
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
            )
            with urlopen(request, timeout=30) as response:
                data = json.loads(response.read().decode("utf-8"))
        except HTTPError as error:
            self._send_json(error.code, {"error": "OpenAI error"})
            return
        except URLError:
            self._send_json(502, {"error": "OpenAI unreachable"})
            return

        try:
            content = data["choices"][0]["message"]["content"]
            result = json.loads(content)
        except (KeyError, IndexError, json.JSONDecodeError):
            self._send_json(502, {"error": "Malformed OpenAI response"})
            return

        self._send_json(200, result)

    def do_GET(self):
        if self.path == "/api/health":
            self._send_json(200, {"status": "ok"})
            return
        self._send_json(404, {"error": "Not found"})


def main():
    server = HTTPServer(("", PORT), Handler)
    print(f"AI proxy listening on http://localhost:{PORT}")
    server.serve_forever()


if __name__ == "__main__":
    main()
