import threading

import webview
from waitress import serve

from app import app


def run_server():
    serve(app, host="127.0.0.1", port=5000)


if __name__ == "__main__":
    threading.Thread(target=run_server, daemon=True).start()
    webview.create_window("Sapphire", "http://127.0.0.1:5000", width=1280, height=800)
    webview.start()
