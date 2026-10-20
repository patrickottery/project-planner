import os

from app import create_app

app = create_app()

if __name__ == "__main__":
    # Dev server only (prod runs gunicorn). Reloads on code changes; the Werkzeug
    # debugger (remote code execution for anyone who can reach the port) stays off
    # unless FLASK_DEBUG=1 is set explicitly.
    app.run(
        host="0.0.0.0",
        port=5000,
        debug=os.environ.get("FLASK_DEBUG") == "1",
        use_reloader=True,
    )
