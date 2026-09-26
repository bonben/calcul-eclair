# Calcul Éclair ⚡

Appli de calcul mental gamifiée : chrono, temps de réaction, combos, points, niveaux et badges.
C'est une appli web installable (PWA) : elle s'installe depuis Chrome et marche ensuite sans internet.

## Installer sur iPhone

1. Ouvrir le lien dans **Chrome** ou **Safari**.
2. Toucher le bouton **Partager** (carré avec une flèche vers le haut). Dans Chrome, il est à droite de la barre d'adresse ; dans Safari, en bas de l'écran.
3. Faire défiler et choisir **« Sur l'écran d'accueil »**, puis **Ajouter**.

Sur iPhone, les sons se coupent si le bouton silencieux est activé, et les vibrations ne sont pas disponibles.

## Installer sur Android

1. Ouvrir le lien dans **Chrome**.
2. Menu **⋮**, puis **Ajouter à l'écran d'accueil** (ou **Installer l'application**).

La progression est enregistrée sur le téléphone.

## Modes

- **Sprint 60 s** : un maximum de calculs en une minute.
- **Survie** : 3 vies, et le temps par question diminue.
- **Défi du jour** : 20 calculs, les mêmes pour tout le monde ce jour-là. Un seul essai par jour : l'essai compte dès le départ, même si on quitte en cours.
- **Astuces de pro** : 10 techniques de calcul mental (×11, ×5, ×9, compléments à 100, carrés en 5…), chacune suivie de 10 calculs pour s'entraîner, notés sur 3 étoiles.

## Méthodes utilisées

- **Difficulté adaptative** : le niveau de chaque opération s'ajuste pour viser environ 90 % de réussite. Pendant les 25 premières réponses de chaque opération, il monte plus vite pour trouver le bon niveau.
- **Répétition espacée** (boîtes de Leitner) : les erreurs reviennent en « revanche » plus tard dans la partie, puis lors des parties suivantes, de plus en plus espacées.
- **Pratique chronométrée courte** (comme Zetamac) : bonus de vitesse (jusqu'à +50 %) et multiplicateur de combo (×1,5 dès 5 bonnes réponses d'affilée, ×2 dès 10).
- **Points liés à la difficulté** : un calcul rapporte deux fois plus de points à chaque niveau. Un calcul difficile rapporte donc plus que plusieurs calculs faciles faits dans le même temps, et le score monte à mesure qu'on progresse.
- **Régularité** : série de jours d'affilée, XP, niveaux, badges.

## Développement

Pas de build : des fichiers statiques (`index.html`, `style.css`, `app.js`, `sw.js`).
Après une modification, changer `VERSION` dans `sw.js` pour que les téléphones récupèrent la mise à jour.

```bash
python3 -m http.server 8765
```
