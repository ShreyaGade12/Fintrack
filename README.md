# 🚀 FinTrack: AI-Powered Personal Finance Tracker

> Your intelligent co-pilot for financial well-being, leveraging AI and real-time analytics to optimize spending and achieve goals.

---

## 🌟 Project Overview
FinTrack is a modern, full-stack personal finance management application designed to empower users with unprecedented control and insight over their spending habits. Beyond traditional tracking, FinTrack integrates advanced AI capabilities, real-time anomaly detection, and behavioral insights to provide proactive financial guidance.

Built with a focus on scalability, robust security, and a delightful user experience, FinTrack aims to transform financial management from a chore into an intuitive, data-driven journey.

This project showcases expertise across:
- Full-stack development
- Data analysis
- Machine learning integration
- DevOps and CI/CD practices

---

## ✨ Key Features

### 🌠 Real-time Anomaly Detection (Online Learning)
- Analyzes expenses using Z-scores and dynamic thresholds
- Detects unusual transactions and sends real-time Socket.IO alerts
- Demonstrates online learning and real-time system design

### 🤖 AI Financial Coach Chatbot
- GPT-style chatbot powered by Google Gemini API
- Personalized advice using real-time financial data

### ❤️‍🩹 Emotional Spending Insights
- Tag expenses with mood
- Visualizes emotion-driven spending patterns

### 🧪 A/B Testing Framework
- Frontend A/B testing with backend analytics
- Optimize UI/UX through experiments

### 📊 Comprehensive Spend Analysis
- Weekly trends, category breakdowns, top vendors
- Tracks budget and savings goals

### 🔐 Robust Authentication & Security
- Firebase Auth + Admin SDK
- Secure JWTs, bcryptjs hashing, Helmet, CORS

### 🐘 PostgreSQL + Sequelize ORM
- Relational data with integrity and type-safe ORM

### 🐳 Containerized Development
- Docker + Docker Compose for consistent environments

### 🚀 CI/CD with Azure Pipelines
- Automated builds and deployments via `azure-pipelines.yml`

---

## 🧱 Technical Stack

### Frontend
- React.js
- Tailwind CSS
- Chart.js
- Socket.IO Client

### Backend
- Node.js
- Express.js
- Sequelize (PostgreSQL ORM)
- pg (PostgreSQL driver)
- bcryptjs, jsonwebtoken, firebase-admin
- socket.io, node-cron
- dotenv, cors, helmet, compression, morgan, express-rate-limit

### Database
- PostgreSQL

### AI/ML
- Google Gemini API

### DevOps & Tools
- Docker
- Docker Compose
- Azure Pipelines
- Git / GitHub

---

## 🌐 Architecture
FinTrack uses a modular, microservices-oriented architecture:

- **Frontend (React SPA):** UI, interaction, API communication
- **Backend (Node.js/Express API):** Business logic, integrations
- **Database:** PostgreSQL via Sequelize
- **External Services:** Firebase, Google Gemini API
- **Real-time Layer:** Socket.IO for alerts and updates

> HLD and LLD diagrams are available in the repository.

---

## 🧰 Getting Started

### 🔧 Prerequisites
- Node.js (LTS)
- npm or Yarn
- Docker Desktop
- Git
- Firebase project
- Google Gemini API Key

### 📥 Installation & Setup

#### Clone the repository:
```bash
git clone https://github.com/AnujGadekar1/FinTrack-AI-Finance-App.git
cd FinTrack-AI-Finance-App
```

#### Backend Setup:
```bash
cd Backend
npm install
```

Create `.env` file:
```env
PORT=5000
CLIENT_URL=http://localhost:80
DATABASE_URL=postgres://myuser:mypassword@postgres: /fintrack 
JWT_SECRET=your_super_secret_jwt_key_here
GEMINI_API_KEY=YOUR_GENERATED_GEMINI_API_KEY_HERE
FIREBASE_SERVICE_ACCOUNT_KEY={}  # JSON as one line
```

#### Frontend Setup:
```bash
cd ../finance-tracker-frontend
npm install
```
Create `nginx/nginx.conf`:
```nginx
server {
  listen 80;
  root /usr/share/nginx/html;
  gzip on;
  gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
  location / {
    try_files $uri $uri/ /index.html;
  }
}
```
Replace `firebaseConfig` in `src/App.js` with your own.

#### Start with Docker Compose:
```bash
cd ..
docker compose up --build
```

---

## 🏃 Usage

1. Go to `http://localhost`
2. Register → Creates Firebase + DB account
3. Login → Explore dashboard
4. Add expenses (tag with mood, test anomalies)
5. Ask AI Coach questions like:
   - "What's my biggest spending category?"
   - "How can I reduce entertainment expenses?"

---

## ⚙️ CI/CD & Deployment

- CI with `azure-pipelines.yml`
- Build & push to DockerHub / Azure Container Registry
- Add future deploy stages to ACI / AKS / App Service

---

## 🔒 Security Considerations

- Firebase Auth
- Backend token verification
- Bcrypt password hashing
- Secure environment management via `.env`
- Helmet, Rate limiting, CORS
- Secure DB config (TLS-ready)

---

## 🔮 Future Enhancements
- [ ] Bill Splitting
- [ ] Auto-Investment Suggestions
- [ ] Tax Report Generation
- [ ] Advanced Fraud Detection
- [ ] Mobile App
- [ ] Bank/API Sync (RazorpayX, Plaid)

---

## 🤝 Contributing
We welcome contributions! Please open an issue or submit a PR.

---

## 📄 License
This project is licensed under the **MIT License**. See the LICENSE file for details.

---

## 📧 Contact
**Anuj Gadekar**  
🔗 [GitHub Profile](https://github.com/AnujGadekar1)  
 

**Project Link:** [FinTrack-AI-Finance-App](https://github.com/AnujGadekar1/FinTrack-AI-Finance-App)
