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

  container.innerHTML = resources.map(resource => `
    <div class="bg-white rounded-lg shadow-md p-6 hover:shadow-xl transition-shadow duration-300">
      <div class="flex items-center justify-between mb-3">
        <span class="inline-block px-3 py-1 text-sm font-semibold text-blue-600 bg-blue-100 rounded-full">
          ${resource.category}
        </span>
        <span class="text-sm text-gray-600">${resource.difficulty}</span>
      </div>
      <h3 class="text-xl font-bold text-gray-800 mb-2">${resource.title}</h3>
      <p class="text-gray-600 mb-4">${resource.description}</p>
      <a href="${resource.link}" class="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium">
        Learn More
        <svg class="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
        </svg>
      </a>
    </div>
  `).join('');
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
