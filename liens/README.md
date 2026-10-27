# Page de liens Budget Talk

Adresse : https://budgettalk.vercel.app/ (projet Vercel « budgettalk », relié à ce dépôt, dossier `liens`, mis à jour tout seul à chaque push sur `main`).
L'ancienne adresse https://leomira-1999.github.io/liens/ renvoie vers la nouvelle.

Tout est dans ce dossier `liens/`. **Ne rien toucher à la racine du dépôt** (index.html, privacy.html, google6ecabfd927d00eea.html servent à autre chose). Ne jamais créer de fichier ou de dossier dont le nom commence par `_`.

## Comment ajouter une vidéo

1. Ouvrir `liens/videos.js` (c'est le seul fichier à modifier).
2. Copier un bloc `{ id: ..., title: ..., publishedAt: ... },` et le coller **en haut de la liste**.
3. Renseigner :
   - `id` : l'identifiant YouTube, 11 caractères. Il est dans l'adresse de la vidéo après `v=` (`https://www.youtube.com/watch?v=PMAmL6JKdU0`) ou après `youtu.be/` (`https://youtu.be/PMAmL6JKdU0`).
   - `title` : le titre de la vidéo, entre guillemets.
   - `publishedAt` : la date et l'heure de sortie **en heure UTC** (le `Z` à la fin).
     Heure de Paris − 1 h en hiver, − 2 h en été. Le changement se fait le dernier dimanche de mars (passage à l'heure d'été : − 2 h) et le dernier dimanche d'octobre (retour à l'heure d'hiver : − 1 h).
     Écrire la date exactement sous cette forme, avec le `T` et le `Z` : sinon certains navigateurs (Safari, applis Instagram/TikTok sur iPhone) ne la comprennent pas.
     Exemple : sortie à 18:00 heure de Paris en hiver → `"2026-11-04T17:00:00Z"`.
4. Enregistrer, puis pousser sur `main`.
5. Attendre 1 à 2 minutes que GitHub Pages publie (le cache peut garder l'ancienne version jusqu'à environ 10 minutes).
6. Vérifier : `node liens/tests/check.js <dossier-pour-les-captures>` (doit finir par « Tout est bon. »). Le test vérifie d'abord `videos.js` (identifiants, doublons, titres, format des dates) puis la page.
   Il faut Node.js et Playwright (avec Chromium). Dans le cloud de Claude, ils sont déjà installés ; sur un ordinateur : `npm install -g playwright` puis `npx playwright install chromium`.

Une vidéo programmée peut être ajoutée à l'avance : elle n'apparaît sur la page qu'à son heure de sortie.

La bande-annonce porte `type: "trailer"` : elle s'affiche toujours dans « Commence ici », jamais en « Dernière vidéo ».

## Fichiers

- `index.html` : la page (en-tête, bouton YouTube, réseaux, pied de page).
- `videos.js` : les vidéos (données).
- `app.js` : affiche les vidéos à partir de `videos.js`.
- `style.css` : l'apparence (couleurs du design system Budget Talk).
- `fonts/` : Montserrat 800 et 900 (titres).
- `avatar.jpg` : le logo de la chaîne (256x256, affiché en rond). Pour le changer, remplacer ce fichier par une image carrée de même nom.
- `icon.png` : l'icône de l'onglet et de l'écran d'accueil (180x180).
- `og.jpg` : l'image qui s'affiche quand on partage le lien (1200x630).
- `tests/check.js` : vérifications et captures d'écran. Avec `--og`, régénère aussi `og.jpg` depuis `tests/og-template.html` (à refaire si `avatar.jpg` change).
