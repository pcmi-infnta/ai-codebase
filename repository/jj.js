// Wait for the DOM content to fully load before running any JavaScript
document.addEventListener('DOMContentLoaded', () => {
  // Example functionality: Display an alert when the "Learn More" button is clicked
  const learnMoreButton = document.createElement('button');
  learnMoreButton.textContent = 'Learn More';
  learnMoreButton.style = 'margin-top: 20px; padding: 10px 20px; font-size: 16px; cursor: pointer; background-color: #4CAF50; color: white; border: none; border-radius: 5px;';

  // Add the button to the footer
  const footer = document.querySelector('.footer');
  footer.appendChild(learnMoreButton);

  // Attach an event listener for the click event
  learnMoreButton.addEventListener('click', () => {
    alert('Programming languages help us bring ideas to life in the digital world!');
  });
});