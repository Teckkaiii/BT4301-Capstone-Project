from flask import Flask
from flask_cors import CORS
from modules.routes import init_routes
from modules.database import init_db

app = Flask(__name__)
CORS(app)

# Initialize MongoDB
init_db()

# Register routes
init_routes(app)

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5001)
