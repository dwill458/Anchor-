# Visual Studio Code Migration Guide 🚀

Based on your current workspace configuration (React Native/Expo frontend, Node/Express/Prisma backend, Jest testing, and Maestro E2E tests), here are the exact VS Code extensions and settings you need to set up a world-class development environment that mirrors and enhances your current setup.

---

## 📦 Core Extensions Checklist

### 1. Formatting & Code Quality (Essential)
*   **ESLint** (`dbaeumer.vscode-eslint`)
    *   *Why you need it:* Connects directly to the ESLint rules in your backend and frontend to show warnings and errors inline as you type.
*   **Prettier - Code formatter** (`esbenp.prettier-vscode`)
    *   *Why you need it:* Integrates with `.prettierrc` in your backend and workspace to automatically format your TypeScript and TSX files on save.

### 2. Mobile Development (Expo & React Native)
*   **Expo Tools** (`expo.expo-vscode`)
    *   *Why you need it:* Autocompletes and validates your `app.json` and `eas.json` files, supports Expo CLI configurations, and makes environment management effortless.
*   **React Native Tools** (`msjsdiag.vscode-react-native`)
    *   *Why you need it:* Provides debugging capabilities, launch configurations, and element inspector integrations for React Native.

### 3. Backend & Database (Node.js & Prisma)
*   **Prisma** (`prisma.prisma`)
    *   *Why you need it:* Essential for syntax highlighting, code-completion, formatting, and linting in your Prisma schema files (`schema.prisma`).

### 4. Testing & Workflows
*   **Jest Runner** (`firsttris.vscode-jest-runner`) or **Jest** (`orta.vscode-jest`)
    *   *Why you need it:* Allows you to run or debug individual Jest tests directly from the source code view (clicking "Run" right above a `describe` or `test` block).
*   **Maestro** (`mobile-dev.maestro-vscode`)
    *   *Why you need it:* Autocomplete and syntax highlighting for your Maestro `.yaml` flow files in the `.maestro` directory, and the ability to run flows directly from VS Code.

### 5. AI & Assistance
*   **Gemini Code Assist** (`google.gemini-code-assist`)
    *   *Why you need it:* To bring the power of Gemini (like the one running in this agent!) directly into VS Code for inline code generation, chat, and explanation.

### 6. Productivity & Syntax
*   **Dotenv** (`mikestead.dotenv`)
    *   *Why you need it:* Syntax highlighting for `.env` files in both backend and mobile directories.
*   **GitLens — Git supercharged** (`eamodio.gitlens`)
    *   *Why you need it:* In-editor Git blame, history navigation, and visualization of changes.

---

## ⚡ Superfast One-Line Installation

You can install all of these extensions automatically with a single command. Open your terminal (PowerShell or CMD) and paste the following:

```powershell
code --install-extension dbaeumer.vscode-eslint --install-extension esbenp.prettier-vscode --install-extension expo.expo-vscode --install-extension msjsdiag.vscode-react-native --install-extension prisma.prisma --install-extension firsttris.vscode-jest-runner --install-extension mobile-dev.maestro-vscode --install-extension google.gemini-code-assist --install-extension mikestead.dotenv --install-extension eamodio.gitlens
```

---

## ⚙️ Recommended VS Code Settings

Once installed, we want to make sure VS Code uses these extensions optimally (especially formatting on save). 

1. Press `Ctrl + Shift + P` (or `Cmd + Shift + P` on macOS) and type **"Preferences: Open User Settings (JSON)"**.
2. Add or merge the following configurations into your `settings.json`:

```json
{
  // Set Prettier as the default formatter
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,

  // Enable formatting and linting for specific file types
  "[javascript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[typescriptreact]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[json]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[prisma]": {
    "editor.defaultFormatter": "prisma.prisma"
  },

  // ESLint automatic code fixing on save
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },

  // Expo-specific files
  "files.associations": {
    "app.json": "jsonc",
    "eas.json": "json"
  }
}
```

This configuration ensures that every time you save a `.ts`, `.tsx`, `.js`, or `.prisma` file, VS Code will use Prettier and ESLint to format and clean up your code instantly!
