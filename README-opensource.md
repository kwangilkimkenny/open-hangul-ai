
# HanView - Open Source Document Viewer

## 🚀 Features

### Open Source Features
- ✅ Multi-format document viewing (HWPX, DOCX, PDF, etc.)
- ✅ Universal LLM integration (OpenAI, Claude, Gemini, etc.)
- ✅ Document editing and annotation
- ✅ Export capabilities
- ✅ Plugin system

### Enterprise Features (Commercial License)
- 🔒 **AEGIS Security Module** - Advanced content filtering and PII protection
- 🔒 **TruthAnchor** - AI-powered fact verification and source validation
- 🔒 **Advanced Analytics** - Usage metrics and compliance reporting
- 🔒 **Priority Support** - Enterprise SLA and custom integrations

## 📦 Installation

### Community Edition (Free)
```bash
npm install hanview-opensource
```

### Enterprise Edition
Contact sales@hanview.ai for commercial licensing.

## 🔧 Usage

### Basic Usage
```typescript
import { HanViewEditor } from 'hanview-opensource';

const editor = new HanViewEditor({
  container: '#editor',
  features: {
    llm: true,           // ✅ Available
    security: false,     // 🔒 Enterprise only
    factCheck: false     // 🔒 Enterprise only
  }
});
```

### With Enterprise Modules
```typescript
import { HanViewEditor } from 'hanview-enterprise';

const editor = new HanViewEditor({
  container: '#editor',
  features: {
    llm: true,           // ✅ Available
    security: true,      // ✅ AEGIS protection
    factCheck: true      // ✅ TruthAnchor verification
  },
  license: 'your-enterprise-license-key'
});
```

## 🤝 Contributing

We welcome contributions to the open source components! Please see CONTRIBUTING.md for guidelines.

## 📄 License

- **Open Source Components**: MIT License
- **Enterprise Modules**: Commercial License Required

## 💬 Support

- **Community Support**: GitHub Issues
- **Enterprise Support**: support@hanview.ai
