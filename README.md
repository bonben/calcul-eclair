# Calcul Éclair ⚡

Appli de calcul mental gamifiée : chrono, temps de réaction, combos, points, niveaux et badges.
C'est une appli web installable (PWA) : elle s'installe depuis Chrome et marche ensuite sans internet.

## Installer sur Android

1. Ouvrir le lien de l'appli dans **Chrome**.
2. Menu **⋮** (en haut à droite), puis **Ajouter à l'écran d'accueil** (ou **Installer l'application**).
3. L'icône ⚡ apparaît sur l'écran d'accueil. L'appli s'ouvre en plein écran, comme une vraie appli.

La progression est enregistrée sur le téléphone.

## Modes

- **Sprint 60 s** : un maximum de calculs en une minute.
- **Survie** : 3 vies, et le temps par question diminue.
- **Défi du jour** : 20 calculs, les mêmes pour tout le monde ce jour-là.
- **Astuces de pro** : 10 techniques de calcul mental (×11, ×5, ×9, compléments à 100, carrés en 5…), chacune suivie de 10 calculs pour s'entraîner, notés sur 3 étoiles.

## Méthodes utilisées

- **Difficulté adaptative** : le niveau de chaque opération s'ajuste pour viser environ 80 % de réussite.
- **Répétition espacée** (boîtes de Leitner) : les erreurs reviennent en « revanche » plus tard dans la partie, puis lors des parties suivantes, de plus en plus espacées.
- **Pratique chronométrée courte** (comme Zetamac) : bonus de vitesse, multiplicateur de combo (×2, ×3, ×4).
- **Régularité** : série de jours d'affilée, XP, niveaux, badges.

## Développement

Pas de build : des fichiers statiques (`index.html`, `style.css`, `app.js`, `sw.js`).
Après une modification, changer `VERSION` dans `sw.js` pour que les téléphones récupèrent la mise à jour.

```bash
python3 -m http.server 8765
```
