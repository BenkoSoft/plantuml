# Publishing Your PlantUML VS Code Extension

## 📋 Pre-Publishing Checklist

### 1. **Update package.json**
- ✅ Set your real `publisher` name (you'll need to create this)
- ✅ Update `author` field with your name
- ✅ Set repository URL if you have one
- ✅ Update description and keywords

### 2. **Create Publisher Account**
Go to [Visual Studio Marketplace Publisher Management](https://marketplace.visualstudio.com/manage)
- Sign in with Microsoft/GitHub account
- Create a new publisher ID (this goes in your package.json)
- Remember this ID - you'll use it in package.json

### 3. **Get Personal Access Token (PAT)**
1. Go to [Azure DevOps](https://dev.azure.com)
2. Sign in with the same account
3. Click on User Settings (top right) → Personal Access Tokens
4. Create new token with:
   - **Name**: VS Code Extension Publishing
   - **Organization**: All accessible organizations
   - **Scopes**: Custom defined → Marketplace → **Manage**
5. **Save this token securely** - you'll need it!

## 🚀 Publishing Steps

### Step 1: Login to vsce
```bash
vsce login your-publisher-name
```
Enter your PAT when prompted.

### Step 2: Package the extension (optional - for testing)
```bash
vsce package
```
This creates a `.vsix` file you can install locally to test.

### Step 3: Publish the extension
```bash
vsce publish
```

## 🔧 Before Publishing Commands

Run these to ensure everything is ready:

```bash
# Make sure code compiles
npm run compile

# Test the extension locally
# (Press F5 in VS Code to test)

# Package to test locally
vsce package

# Install the packaged extension to test
code --install-extension plantuml-preview-1.0.0.vsix
```

## 📝 Publishing Options

### Option 1: Publish directly
```bash
vsce publish
```

### Option 2: Publish with version bump
```bash
vsce publish patch    # 1.0.0 → 1.0.1
vsce publish minor    # 1.0.0 → 1.1.0
vsce publish major    # 1.0.0 → 2.0.0
```

### Option 3: Publish specific version
```bash
vsce publish 1.0.1
```

## ✅ Post-Publishing

1. **Verify on Marketplace**: Check your extension at:
   `https://marketplace.visualstudio.com/items?itemName=your-publisher.plantuml-preview`

2. **Install from Marketplace**: Test installing from VS Code Extension view

3. **Update README**: Consider adding installation badge:
   ```markdown
   [![Visual Studio Marketplace](https://img.shields.io/visual-studio-marketplace/v/your-publisher.plantuml-preview)](https://marketplace.visualstudio.com/items?itemName=your-publisher.plantuml-preview)
   ```

## 🔄 Updating Your Extension

To publish updates:
```bash
# Make your changes
npm run compile
vsce publish patch  # or minor/major
```

## ❌ Common Issues

### "Publisher not found"
- Make sure you created the publisher account
- Use exact publisher name from the marketplace

### "PAT token issues"
- Ensure token has **Marketplace: Manage** permissions
- Token must be from the same account as publisher

### "Missing repository"
- Add repository field to package.json
- Or use `vsce publish --allow-missing-repository`

### "Icon missing"
- Add an icon file and reference it in package.json:
  ```json
  "icon": "icon.png"
  ```

## 📊 Analytics

After publishing, you can view:
- Download statistics
- User feedback
- Install metrics

Visit your publisher page to see analytics.

## 🎯 Tips for Success

1. **Good README**: Include screenshots and clear usage instructions
2. **Keywords**: Use relevant keywords for discoverability  
3. **Categories**: Choose appropriate categories
4. **Version**: Follow semantic versioning
5. **Testing**: Test thoroughly before publishing

## 🔗 Useful Links

- [VS Code Extension Publishing Guide](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [Publisher Management Portal](https://marketplace.visualstudio.com/manage)
- [Azure DevOps (for PAT)](https://dev.azure.com) 