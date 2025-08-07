## Generative UX

This prototype uses AI (specifically ChatGPT) to dynamically render user interfaces based on natural language prompts. Users can describe what they want to see, and the AI generates functional UI components in real-time.
Available Components
The system can generate and arrange the following UI components:

Text Elements: header, subheader, text
Interactive Components: button, iconButton, textInput, checkbox, switch, slider
Visual Elements: icon, avatar, image, borderImage
Layout Components: list-item, space
Layout System: flexible rows and columns for responsive design

### AI-Powered Features

Natural Language Processing: Describe interfaces using plain English
Dynamic Content Generation: AI creates contextually relevant content
Function Calling Integration: Connects to external APIs for live data
Amazon Product Integration: Currently integrated to display real Amazon products

### Getting Started

To run this prototype locally:

Create accounts and obtain API keys for:

OpenAI (for AI interface generation)
FAL (for image generation capabilities)
Oxylabs (for web scraping functionality)

Set up environment variables:

Create a .env file in the /backend directory
Add your API keys using the format shown in .env.example

Start the application:
bash# Backend
cd backend && npm start

bash# Frontend

cd frontend && npm start

This prototype demonstrates the potential for AI-driven interface design and dynamic content generation in modern web applications.
