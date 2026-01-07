import datetime
import os
import sys
import time


LOG_PATH = os.getenv("AI_PROXY_LOG", "ai-proxy.log")


def tail_file(path):
    if not os.path.exists(path):
        print(f"Waiting for log file: {path}")
        while not os.path.exists(path):
            time.sleep(0.5)

    with open(path, "r", encoding="utf-8") as handle:
        handle.seek(0, os.SEEK_END)
        while True:
            line = handle.readline()
            if not line:
                time.sleep(0.25)
                continue
            yield line.rstrip("\n")


def main():
    print(f"Tailing {LOG_PATH}. Press Ctrl+C to stop.")
    for line in tail_file(LOG_PATH):
        now = datetime.datetime.now().strftime("%H:%M:%S")
        tag = "OK"
        if "error" in line.lower() or "exception" in line.lower():
            tag = "ERROR"
        print(f"[{now}] [{tag}] {line}")


if __name__ == "__main__":
    main()
