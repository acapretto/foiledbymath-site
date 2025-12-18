// Main JavaScript file for Foiled by Math landing page

// Function to fetch and render resource cards
async function loadResources() {
  try {
    const response = await fetch('./data/resources.json');
    if (!response.ok) {
      throw new Error('Failed to load resources');
    }
    const resources = await response.json();
    renderResourceCards(resources);
  } catch (error) {
    console.error('Error loading resources:', error);
    displayError();
  }
}

// Function to render resource cards
function renderResourceCards(resources) {
  const container = document.getElementById('resources-container');
  
  if (!container) {
    console.error('Resources container not found');
    return;
  }

  // Clear container
  container.innerHTML = '';
  
  // Create cards using DOM methods to avoid XSS
  resources.forEach(resource => {
    const card = document.createElement('div');
    card.className = 'bg-white rounded-lg shadow-md p-6 hover:shadow-xl transition-shadow duration-300';
    
    // Header with category and difficulty
    const header = document.createElement('div');
    header.className = 'flex items-center justify-between mb-3';
    
    const categoryBadge = document.createElement('span');
    categoryBadge.className = 'inline-block px-3 py-1 text-sm font-semibold text-blue-600 bg-blue-100 rounded-full';
    categoryBadge.textContent = resource.category;
    
    const difficultyText = document.createElement('span');
    difficultyText.className = 'text-sm text-gray-600';
    difficultyText.textContent = resource.difficulty;
    
    header.appendChild(categoryBadge);
    header.appendChild(difficultyText);
    
    // Title
    const title = document.createElement('h3');
    title.className = 'text-xl font-bold text-gray-800 mb-2';
    title.textContent = resource.title;
    
    // Description
    const description = document.createElement('p');
    description.className = 'text-gray-600 mb-4';
    description.textContent = resource.description;
    
    // Link with arrow
    const link = document.createElement('a');
    link.href = resource.link;
    link.className = 'inline-flex items-center text-blue-600 hover:text-blue-800 font-medium';
    link.textContent = 'Learn More ';
    
    // Create SVG arrow using innerHTML for the SVG only (safe for static content)
    const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    arrow.setAttribute('class', 'w-4 h-4 ml-1');
    arrow.setAttribute('fill', 'none');
    arrow.setAttribute('stroke', 'currentColor');
    arrow.setAttribute('viewBox', '0 0 24 24');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('d', 'M9 5l7 7-7 7');
    arrow.appendChild(path);
    link.appendChild(arrow);
    
    // Assemble card
    card.appendChild(header);
    card.appendChild(title);
    card.appendChild(description);
    card.appendChild(link);
    
    container.appendChild(card);
  });
}

// Function to display error message
function displayError() {
  const container = document.getElementById('resources-container');
  if (container) {
    container.innerHTML = `
      <div class="col-span-full text-center py-8">
        <p class="text-gray-600">Unable to load resources. Please try again later.</p>
      </div>
    `;
  }
}

// Smooth scroll for navigation links
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;
      
      e.preventDefault();
      const targetElement = document.querySelector(targetId);
      
      if (targetElement) {
        targetElement.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });
}

// Mobile menu toggle
function initMobileMenu() {
  const menuButton = document.getElementById('mobile-menu-button');
  const mobileMenu = document.getElementById('mobile-menu');
  
  if (menuButton && mobileMenu) {
    menuButton.addEventListener('click', () => {
      mobileMenu.classList.toggle('hidden');
    });
  }
}

// Initialize everything when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  loadResources();
  initSmoothScroll();
  initMobileMenu();
});
