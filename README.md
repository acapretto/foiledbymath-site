# Foiled by Math - Landing Page

A simple, static landing page for the "Foiled by Math" teacher brand. This site provides an engaging introduction to math education resources using plain HTML, Tailwind CSS via CDN, and vanilla JavaScript.

## 🚀 Features

- **Hero Section**: Eye-catching introduction with call-to-action buttons
- **Resources Section**: Dynamically rendered educational resource cards from JSON data
- **About Section**: Information about the teaching philosophy and approach
- **Responsive Design**: Mobile-friendly layout using Tailwind CSS
- **No Build Step Required**: Deploy directly to any static host

## 📁 Project Structure

```
foiledbymath-site/
├── index.html              # Main landing page
├── js/
│   └── main.js            # JavaScript for dynamic resource loading
├── data/
│   └── resources.json     # Educational resources data
└── README.md              # This file
```

## 🛠️ Technologies Used

- **HTML5**: Semantic markup for structure
- **Tailwind CSS**: Utility-first CSS framework (loaded via CDN)
- **Vanilla JavaScript**: Dynamic resource rendering and smooth scrolling
- **JSON**: Data storage for educational resources

## 🌐 Deployment

### Netlify (Recommended)

This site is designed to deploy to Netlify with zero configuration:

1. Connect your GitHub repository to Netlify
2. Leave all build settings empty (no build command needed)
3. Deploy!

**Build Settings:**
- Build command: (leave empty)
- Publish directory: (leave empty or set to `/`)

The site will deploy as-is since it requires no build process.

### Other Static Hosts

You can also deploy to:
- **GitHub Pages**: Push to `gh-pages` branch or configure in repository settings
- **Vercel**: Connect repository and deploy with zero config
- **Cloudflare Pages**: Connect repository and deploy
- **Any static host**: Simply upload all files to your web server

## 💻 Local Development

To run locally, simply open `index.html` in a web browser. However, to properly load the JSON resources, you'll need to serve the files through a local web server:

### Option 1: Python HTTP Server
```bash
# Python 3
python -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000
```

Then visit `http://localhost:8000`

### Option 2: Node.js HTTP Server
```bash
npx http-server -p 8000
```

Then visit `http://localhost:8000`

### Option 3: PHP Built-in Server
```bash
php -S localhost:8000
```

Then visit `http://localhost:8000`

## 📝 Customization

### Adding Resources

Edit `data/resources.json` to add or modify educational resources:

```json
{
  "id": 7,
  "title": "Your Resource Title",
  "description": "Description of the resource",
  "category": "Category Name",
  "difficulty": "Beginner|Intermediate|Advanced",
  "link": "https://example.com"
}
```

### Styling

The site uses Tailwind CSS via CDN. To customize:
- Modify HTML classes directly in `index.html`
- All Tailwind utility classes are available
- No build process required

### Content

Update content directly in `index.html`:
- Hero section text and CTAs
- About section content
- Footer information

## 🎨 Design Philosophy

- **Clean and Simple**: Focus on content without distractions
- **Accessible**: Semantic HTML and clear navigation
- **Fast Loading**: Minimal dependencies, all assets via CDN
- **Mobile-First**: Responsive design that works on all devices

## 📄 License

This project is open source and available for educational purposes.

## 🙋 Support

For questions or issues, please open an issue on the GitHub repository.
