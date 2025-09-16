# AIM-RED Toolkit

A visual flow-based Python IDE with VS Code-level development experience through Language Server Protocol (LSP) integration. Build, connect, and execute Python code nodes in an intuitive visual environment with real-time code intelligence.

## Features

- **Visual Flow Programming**: Create and connect Python nodes in an interactive diagram
- **VS Code-Level Intelligence**: Full LSP support with Pyright and Ruff
  - Real-time type checking and auto-completion
  - Intelligent code suggestions based on installed packages
  - Instant linting and formatting
  - Go to definition and hover information
- **Project Isolation**: Each project has its own Python virtual environment
- **Auto-Recovery**: LSP processes automatically restart with exponential backoff
- **Docker-Ready**: Fully containerized with production-ready configurations

## Quick Start

### Prerequisites

- Docker and Docker Compose installed
- Node.js 20+ and pnpm (for local development)
- Python 3.11+ (for local development)

### 🚀 Running with Docker (Recommended)

#### Development Mode
```bash
# Clone the repository
git clone https://github.com/AIM-Intelligence/AIM-RED-TOOLKIT.git
cd aim-red-toolkit

# Start services with hot reload and debug logging
docker-compose -f docker-compose.dev.yml up --build

# Access the application
# Frontend: http://localhost:5173
# Backend API: http://localhost:8000
# API Docs: http://localhost:8000/docs
```

#### Production Mode
```bash
# Build and run production containers
docker-compose -f docker-compose.prod.yml up --build

# Access at http://localhost (nginx serves the frontend)
```

### 💻 Local Development

```bash
# Install pnpm globally
npm install -g pnpm

# Install all dependencies
pnpm install

# Run both frontend and backend concurrently
pnpm dev

# Or run services individually
pnpm frontend:dev  # Frontend on http://localhost:5173
pnpm backend:dev   # Backend on http://localhost:8000
```

## Usage Guide

### Creating Your First Project

1. **Open the application** at http://localhost:5173
2. **Create a new project** using the "New Project" button
3. **Add nodes** to your flow:
   - **Start Node**: Entry point for flow execution
   - **Custom Node**: Write Python code that processes data
   - **Result Node**: Display output from connected nodes
4. **Connect nodes** by dragging from output to input ports
5. **Write code** in custom nodes - enjoy full IntelliSense!
6. **Execute the flow** from any start node

### LSP Features in Action

When editing Python code in nodes, you'll get:

- **Auto-completion**: Type `import ` and see available packages
- **Type hints**: Hover over variables to see their types
- **Error detection**: Red squiggles for syntax and type errors
- **Quick fixes**: Automatic import suggestions
- **Package awareness**: IntelliSense for installed packages in project's venv

### Managing Packages

Each project has its own Python environment:

```python
# In any custom node, you can use installed packages
import numpy as np
import pandas as pd

def process(input_data):
    # Full IntelliSense for numpy and pandas!
    array = np.array(input_data)
    df = pd.DataFrame(array)
    return df.to_dict()
```

To install packages:
1. Open the IDE for a node
2. Use the package manager in the UI
3. LSP automatically restarts to recognize new packages

## API Endpoints

### Core Endpoints
- `GET /` - API information
- `GET /api/health` - Health check
- `GET /api/project/` - List all projects
- `POST /api/project/make` - Create new project
- `POST /api/project/execute-flow` - Execute node flow

### LSP Management
- `WS /api/lsp/python` - Pyright LSP WebSocket
- `WS /api/lsp/ruff` - Ruff LSP WebSocket
- `GET /api/lsp/health` - Check LSP status
- `POST /api/lsp/restart/{lsp_type}` - Restart LSP server
- `GET /api/lsp/logs` - View LSP event logs

### Package Management
- `POST /api/code/packages/install` - Install Python package
- `POST /api/code/packages/uninstall` - Remove package
- `GET /api/code/packages/list` - List installed packages

## Docker Commands

```bash
# Build images
docker-compose build

# Start services
docker-compose up

# Start in background
docker-compose up -d

# View logs
docker-compose logs -f

# Check LSP logs specifically
docker-compose logs -f backend | grep LSP

# Stop services
docker-compose down

# Clean everything (including volumes)
docker-compose down -v
```

## Monitoring LSP Health

### Check LSP Status
```bash
# Check both Pyright and Ruff status for a project
curl http://localhost:8000/api/lsp/health?project_id=your_project_id

# Check global LSP status
curl http://localhost:8000/api/lsp/status
```

### View LSP Logs
```bash
# Recent LSP events
curl http://localhost:8000/api/lsp/logs?n=50

# Stdio logs for debugging
curl "http://localhost:8000/api/lsp/stdio?project_id=your_project_id&lsp_type=pyright&stream=stderr"
```

### Restart LSP if Needed
```bash
# Restart Pyright for a project
curl -X POST "http://localhost:8000/api/lsp/restart/pyright?project_id=your_project_id"

# Restart Ruff
curl -X POST "http://localhost:8000/api/lsp/restart/ruff?project_id=your_project_id"
```

## Environment Variables

### Backend (LSP Configuration)
```bash
LSP_LOG_LEVEL=DEBUG          # Log level: DEBUG, INFO, WARNING, ERROR
LSP_IDLE_TTL_MS=600000       # Idle timeout before stopping LSP (10 min)
LSP_MAX_RESTARTS=5           # Max restart attempts
LSP_RESTART_WINDOW_MS=60000  # Time window for restart counting
```

### Frontend
```bash
VITE_API_URL=http://backend:8000  # Backend API URL
```

## Troubleshooting

### LSP Not Working?

1. **Check if LSP is running**:
   ```bash
   curl http://localhost:8000/api/lsp/health?project_id=your_project_id
   ```

2. **View LSP logs**:
   ```bash
   docker-compose logs backend | grep -i lsp
   ```

3. **Manually restart LSP**:
   ```bash
   curl -X POST "http://localhost:8000/api/lsp/restart/pyright?project_id=your_project_id"
   ```

### Common Issues

- **No auto-completion**: Check if project virtual environment exists
- **Import errors**: Install required packages in project's venv
- **WebSocket disconnection**: Check browser console for connection errors
- **High CPU usage**: Adjust `LSP_IDLE_TTL_MS` to close idle processes faster

### Container Issues

```bash
# Rebuild containers after dependency changes
docker-compose build --no-cache

# Check container logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Access backend container
docker exec -it aim-red-backend-dev bash

# Check if pyright is installed
docker exec aim-red-backend-dev pyright --version
```

## Development Tips

### Testing LSP Locally
```bash
# Test Pyright directly
cd packages/backend
pyright-langserver --stdio

# Test Ruff
ruff server
```

### Adding New LSP Features
1. Update `lsp_manager.py` for process management
2. Modify `lsp.py` for WebSocket handling
3. Enhance `pythonLspClient.ts` for frontend integration
4. Test with `docker-compose -f docker-compose.dev.yml up`

## Architecture

```
┌─────────────┐     WebSocket    ┌─────────────┐
│   Frontend  │ ←───────────────→ │   Backend   │
│   (React)   │                   │  (FastAPI)  │
└─────────────┘                   └─────────────┘
       │                                 │
       │                                 ├── LSP Manager
   Monaco Editor                         ├── Pyright Process
       │                                 ├── Ruff Process
   LSP Client                            └── VEnv Manager
```

## Security Considerations

For production deployment:

- Implement authentication and authorization
- Use HTTPS for all connections
- Sandbox code execution environments
- Set resource limits for containers
- Regularly update dependencies
- Monitor and limit LSP process resources

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `pnpm test`
5. Submit a pull request

## License

MIT

## Support

For issues and questions:
- GitHub Issues: [Report bugs or request features](https://github.com/AIM-Intelligence/AIM-RED-TOOLKIT/issues)
- Documentation: Check `/docs` folder for detailed guides

---

Built with ❤️ for the Python community. Enjoy VS Code-level coding experience in your browser!
