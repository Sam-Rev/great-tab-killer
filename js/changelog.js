import {gsUtils} from "./helpers/gsUtils.js";

(function() {
  'use strict';

  gsUtils.documentReadyAndLocalisedAsPromsied(document).then(function() {
    // hide noIncognito items in incognito mode
    if (chrome.extension.inIncognitoContext) {
      Array.prototype.forEach.call(
        document.getElementsByClassName('noIncognito'),
        function(el) { el.style.display = 'none'; }
      );
    }

    // Rating widget logic
    const starsContainer = document.getElementById('cl-rating-stars');
    if (starsContainer) {
      const stars = Array.from(starsContainer.querySelectorAll('span'));
      const messageDiv = document.getElementById('cl-rating-message');

      stars.forEach((star, index) => {
        star.addEventListener('mouseover', () => {
          if (!starsContainer.dataset.rated) {
            stars.forEach((s, i) => {
              if (i <= index) s.classList.add('active');
              else s.classList.remove('active');
            });
          }
        });

        star.addEventListener('mouseout', () => {
          if (!starsContainer.dataset.rated) {
            stars.forEach(s => s.classList.remove('active'));
          }
        });

        star.addEventListener('click', () => {
          if (starsContainer.dataset.rated) return; // Prevent multiple ratings

          const rating = index + 1;
          starsContainer.dataset.rated = rating;

          // Lock the stars display
          stars.forEach((s, i) => {
            if (i < rating) s.classList.add('active');
            else s.classList.remove('active');
            s.style.cursor = 'default';
            s.style.transform = 'none'; // remove hover effect
          });

          // Show appropriate message
          messageDiv.style.display = 'block';
          if (rating === 5) {
            messageDiv.innerHTML = gsUtils.getMessage('html_changelog_rating_5stars');
          } else {
            messageDiv.innerHTML = gsUtils.getMessage('html_changelog_rating_feedback');
          }
        });
      });
    }
  });
})();
