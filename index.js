import { fetchJSON, renderProjects, fetchGitHubData } from './global.js';

async function displayLatestProjects() {
    try {
        // Dynamically determine whether to use a local path or GitHub Pages URL
        const baseUrl = window.location.hostname.includes("github.io")
            ? "https://raw.githubusercontent.com/jessicaaa04/portfolio/main/lib/projects.json"
            : "../lib/projects.json"; 

        console.log(`Fetching projects from: ${baseUrl}`);

        const projects = await fetchJSON(baseUrl);

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

// ----------------- GitHub Stats ------------------
const githubUsername = 'jessicaaa04';

async function displayGitHubStats() {
    try {
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
    } catch (error) {
        console.error("Error fetching GitHub stats:", error);
    }
}

displayGitHubStats();
