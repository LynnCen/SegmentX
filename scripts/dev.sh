#!/bin/bash

echo "=== SegmentX 开发环境 ==="

PROJECT_DIR="$(dirname "$0")/.."
cd "$PROJECT_DIR"

# 启动后端
echo "🚀 启动后端 (http://localhost:8000)..."
cd backend
if [ -d "venv" ]; then
  source venv/bin/activate
fi
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
cd ..

# 等待后端
sleep 2

# 启动前端
echo "🚀 启动前端 (http://localhost:5173)..."
cd frontend
pnpm dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "============================================"
echo "  SegmentX 已启动!"
echo "  前端: http://localhost:5173"
echo "  后端: http://localhost:8000"
echo "  API 文档: http://localhost:8000/docs"
echo "============================================"
echo ""
echo "按 Ctrl+C 停止所有服务"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
