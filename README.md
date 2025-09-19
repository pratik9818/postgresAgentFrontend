# ChatGPT Clone - Chat Application

A modern, dark-mode chat application inspired by ChatGPT's interface, built with vanilla JavaScript and following OOP principles.

## Features

### 🎨 **Modern UI/UX**
- Dark mode design matching ChatGPT's aesthetic
- Responsive layout that works on desktop and mobile
- Smooth animations and transitions
- Clean, minimalist interface

### 💬 **Chat Management**
- Create new chats with custom names
- Edit chat names inline
- Delete entire conversations
- Server-side chat storage (no localStorage for chat data)
- Chat history with message previews

### ✏️ **Message Features**
- Send and receive messages
- Edit individual messages
- Delete specific messages
- Auto-resizing input field
- Typing indicators for AI responses

### 🔧 **Technical Features**
- Object-oriented architecture with separate classes
- Modular component design
- Event-driven communication
- Keyboard shortcuts (Ctrl+N for new chat, Ctrl+K to focus input)
- Mobile-responsive sidebar
- User data and token persistence with localStorage

## File Structure

```
├── pages/
│   └── chat.html          # Main chat page
├── css/
│   ├── index.css          # Login page styles
│   └── chat.css           # Chat page styles
├── js/
│   ├── Message.js         # Message class
│   ├── ChatManager.js     # Chat management logic
│   ├── Sidebar.js         # Sidebar component
│   ├── ChatArea.js        # Main chat interface
│   └── app.js             # Main application controller
├── index.html             # Login page
└── README.md              # This file
```

## Classes Overview

### `Message`
- Handles individual message operations
- Supports editing and deletion
- Creates HTML elements for display

### `ChatManager`
- Manages all chat operations (CRUD)
- Server-side chat storage (no localStorage for chat data)
- Coordinates between components

### `Sidebar`
- Manages the chat list sidebar
- Handles chat selection and actions
- Mobile-responsive behavior

### `ChatArea`
- Main chat interface
- Message display and input handling
- AI response simulation

### `App`
- Main application controller
- Initializes all components
- Handles global events and shortcuts

## Usage

1. **Login**: Use the Google authentication on the main page
2. **Create Chat**: Click "New Chat" or use Ctrl+N
3. **Send Messages**: Type in the input field and press Enter
4. **Edit Chat Name**: Click the edit icon next to a chat name
5. **Delete Chat**: Click the trash icon next to a chat name
6. **Edit Messages**: Hover over a message and click the edit icon
7. **Delete Messages**: Hover over a message and click the trash icon

## Keyboard Shortcuts

- `Ctrl/Cmd + N`: Create new chat
- `Ctrl/Cmd + K`: Focus input field
- `Enter`: Send message
- `Shift + Enter`: New line in input
- `Escape`: Close modals/sidebar

## Mobile Features

- Collapsible sidebar
- Touch-friendly interface
- Responsive design
- Mobile menu button

## Browser Support

- Modern browsers with ES6+ support
- localStorage support required (for user data and tokens only)
- CSS Grid and Flexbox support

## Future Enhancements

- Real AI API integration
- Message search functionality
- Export/import chat history
- Message formatting (markdown)
- File upload support
- Voice messages
- Chat sharing

## Development

The application is built with vanilla JavaScript following OOP principles. Each component is self-contained and communicates through events, making it easy to maintain and extend.

### Adding New Features

1. Create new classes following the existing pattern
2. Use the event system for component communication
3. Maintain separation of concerns
4. Follow the existing naming conventions
5. Add appropriate error handling

## License

This project is for educational purposes. Please respect OpenAI's terms of service when integrating with their APIs.
