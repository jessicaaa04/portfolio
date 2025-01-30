import { fetchJSON, renderProjects } from '../global.js';

async function displayLatestProjects() {
    try {
        const projects = await fetchJSON('../lib/projects.json');

        if (!projects || projects.length === 0) {
            console.warn("No projects found in JSON.");
            return;
        }

        const latestProjects = projects.slice(0, 3);

        const projectsContainer = document.querySelector('.projects');
        
        if (!projectsContainer) {
            console.error("No '.projects' container found in the DOM.");
            return;
        }

        renderProjects(latestProjects, projectsContainer, 'h2');

    } catch (error) {
        console.error("Error loading latest projects:", error);
    }
}

window.addEventListener('DOMContentLoaded', displayLatestProjects);

import { fetchGitHubData } from './global.js';
const githubUsername = 'jessicaaa04';

async function displayGitHubStats() {
    const githubData = await fetchGitHubData(githubUsername);

    if (!githubData) {
        console.error("No GitHub data received.");
        return;
    }

    const profileStats = document.querySelector('#profile-stats');

    if (profileStats) {
        profileStats.innerHTML = `
            <dl>
                <dt>Public Repos:</dt> <dd>${githubData.public_repos}</dd>
                <dt>Public Gists:</dt> <dd>${githubData.public_gists}</dd>
                <dt>Followers:</dt> <dd>${githubData.followers}</dd>
                <dt>Following:</dt> <dd>${githubData.following}</dd>
            </dl>
        `;
    }
}

displayGitHubStats();
