graph TD
    %% === USER LAYER ===
    subgraph User Interaction
        Browser["Web Browser"]
        Developer["Developer"]
    end

    %% === FRONTEND ===
    subgraph "Frontend Application"
        FE_React["React.js App"]
        FE_SocketIO_Client["Socket.IO Client"]
        FE_AB_Test_Logic["A/B Test Assignment & Tracking"]
    end

    %% === BACKEND ===
    subgraph "Backend Services"
        BE_Node_Express["Node.js / Express.js API"]
        BE_Auth["Authentication Module"]
        BE_Expense_Mgmt["Expense Management"]
        BE_Budget_Mgmt["Budget Management"]
        BE_Goal_Mgmt["Goal Management"]
        BE_Analytics["Analytics & A/B Tracking"]
        BE_AI_Coach["AI Coach Interface"]
        BE_Anomaly_Detect["Real-time Anomaly Detection"]
        BE_Integrations["External Integrations"]
        BE_Notifications["Notification Service"]
        BE_SocketIO_Server["Socket.IO Server"]
    end

    %% === DATA LAYER ===
    subgraph "Data Layer"
        DB_PostgreSQL["PostgreSQL Database"]
        DB_Sequelize["Sequelize ORM"]
    end

    %% === EXTERNAL SERVICES ===
    subgraph "External Services"
        Firebase_Auth["Firebase Authentication"]
        Google_Gemini_API["Google Gemini API"]
        External_Email_SMS["External Email/SMS APIs"]
    end

    %% === DEVOPS ===
    subgraph "Deployment & Operations"
        Docker_Compose["Docker Compose - Local Dev"]
        Azure_Pipelines["Azure Pipelines - CI/CD"]
        Container_Registry["Container Registry (Docker Hub / ACR)"]
        Git_Repo["Git Repository"]
    end

    %% === CONNECTIONS ===
    Browser --> FE_React
    FE_React -->|HTTP/HTTPS API Calls| BE_Node_Express
    FE_React -->|WebSocket Connection| FE_SocketIO_Client

    FE_SocketIO_Client -->|Real-time Alerts| BE_SocketIO_Server

    BE_Node_Express --> BE_Auth
    BE_Node_Express --> BE_Expense_Mgmt
    BE_Node_Express --> BE_Budget_Mgmt
    BE_Node_Express --> BE_Goal_Mgmt
    BE_Node_Express --> BE_Analytics
    BE_Node_Express --> BE_AI_Coach
    BE_Node_Express --> BE_Anomaly_Detect
    BE_Node_Express --> BE_Integrations
    BE_Node_Express --> BE_Notifications
    BE_Node_Express --> BE_SocketIO_Server

    BE_Node_Express --> DB_Sequelize
    DB_Sequelize --> DB_PostgreSQL

    BE_AI_Coach -->|LLM Prompts| Google_Gemini_API
    BE_Anomaly_Detect -->|Queries Historical Data| DB_PostgreSQL
    BE_Anomaly_Detect -->|Triggers| BE_Notifications

    BE_Integrations -->|Connects to| External_Email_SMS
    External_Email_SMS -->|Provides Data| BE_Expense_Mgmt

    BE_Notifications -->|Sends Alerts| FE_SocketIO_Client

    Developer -->|Pushes Code| Git_Repo
    Git_Repo -->|Triggers| Azure_Pipelines
    Azure_Pipelines -->|Builds & Pushes Docker Images| Container_Registry

    Docker_Compose --> FE_React
    Docker_Compose --> BE_Node_Express
    Docker_Compose --> DB_PostgreSQL
