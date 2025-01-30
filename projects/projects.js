import { fetchJSON, renderProjects } from '../global.js';

async function loadProjects() {
    try {
        // Fetch projects from JSON file
        const projects = await fetchJSON('../lib/projects.json');
        
        // Select the container element for projects
        const projectsContainer = document.querySelector('.projects');
        
        // Select the title element
        const projectsTitle = document.querySelector('.projects-title');
        
        // Update the title with the project count
        if (projectsTitle) {
            projectsTitle.textContent = `${projects.length} Projects`;
        }

        // Render the projects in the container
        renderProjects(projects, projectsContainer, 'h2');

    } catch (error) {
        console.error('Error loading projects:', error);
    }
}

// Load projects when the page loads
document.addEventListener('DOMContentLoaded', loadProjects);
