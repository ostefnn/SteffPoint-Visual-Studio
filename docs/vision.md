# SteffPoint Visual Studio

> **Create once. Publish everywhere.**

## 1. Vision

SteffPoint Visual Studio est une évolution conceptuelle de Cover Studio destinée à transformer rapidement des captures d'écran, logos, textes et éléments de marque en packs visuels cohérents prêts à être publiés.

L'objectif n'est pas de reproduire Canva, Figma ou Photoshop. L'application doit rester guidée, rapide et accessible à un utilisateur non designer.

### Proposition de valeur

**Importer → composer → décliner → exporter**

À partir d'une composition unique, l'utilisateur peut produire plusieurs formats :

- LinkedIn ;
- Open Graph ;
- carré 1:1 ;
- Story 9:16 ;
- GitHub / README ;
- Product Hunt ;
- bannière ;
- miniature ;
- dimensions personnalisées.

## 2. Origine et licence

Le projet peut s'inspirer et réutiliser des éléments du projet open source Cover Studio :

- dépôt d'origine : https://github.com/roosveltkn/cover-studio
- licence : MIT

La licence MIT autorise notamment l'utilisation, la modification, la distribution et l'utilisation commerciale du code, sous réserve de conserver la notice de copyright et le texte de licence applicables.

### Recommandation

Créer un nouveau dépôt plutôt qu'un simple fork si l'objectif est de donner au produit une identité et une architecture propres.

Conserver :

- la licence MIT originale pour les parties concernées ;
- les mentions de copyright requises ;
- une section `Credits` dans le README ;
- idéalement un fichier `THIRD_PARTY_NOTICES.md` pour tracer les dépendances et assets tiers.

Les polices, icônes, images, mockups et autres ressources tierces doivent être vérifiés séparément : la licence MIT du code ne garantit pas automatiquement leur réutilisation.

## 3. Positionnement

### Ce que le produit doit être

Un outil spécialisé permettant de créer en quelques minutes un ensemble de visuels professionnels et cohérents à partir de contenus existants.

### Ce qu'il ne doit pas devenir

- un clone de Canva ;
- un éditeur vectoriel complet ;
- un remplaçant de Figma ;
- un Photoshop dans le navigateur ;
- un outil nécessitant des dizaines de panneaux et réglages avant d'obtenir un résultat.

Le principe directeur reste :

> **Un résultat professionnel en deux minutes sans devoir être designer.**

## 4. Public cible

- développeurs présentant leurs applications ;
- équipes produit ;
- créateurs de projets open source ;
- équipes communication ;
- administrateurs et développeurs Microsoft 365 ;
- créateurs de solutions SharePoint / Power Platform ;
- indépendants ;
- utilisateurs publiant régulièrement sur LinkedIn ou GitHub.

## 5. Parcours utilisateur cible

1. Créer ou ouvrir un projet.
2. Sélectionner un Brand Kit.
3. Importer screenshots, logo et assets.
4. Choisir un template.
5. Saisir titre et sous-titre.
6. Ajuster cadrage et point focal.
7. Prévisualiser plusieurs formats.
8. Créer éventuellement des variantes.
9. Sélectionner les formats de sortie.
10. Exporter le pack.

## 6. Fonctionnalités héritées à conserver

- système de templates ;
- import de screenshots ;
- drag & drop ;
- couleur principale de marque ;
- palette dérivée ;
- mockups navigateur et mobile ;
- prévisualisation immédiate ;
- génération d'image côté client ;
- React et TypeScript ;
- gestion d'état légère ;
- fonctionnement local-first ;
- capture d'URL facultative et isolée du cœur de l'application.

## 7. Project Manager

Passer d'une logique `créer → exporter` à :

**créer → sauvegarder → rouvrir → modifier → décliner → exporter**

### Fonctions

- nouveau projet ;
- sauvegarde automatique ;
- renommage ;
- duplication ;
- suppression ;
- date de dernière modification ;
- miniature automatique ;
- favoris ;
- recherche ;
- import/export du projet en JSON.

### Stockage local

Utiliser **IndexedDB** pour stocker :

- configurations ;
- Blob d'images ;
- miniatures ;
- Brand Kits ;
- assets ;
- historique récent.

Éviter `localStorage` pour les contenus binaires volumineux.

## 8. Format projet

Exemple conceptuel :

```json
{
  "schemaVersion": "1.0",
  "name": "Cockpit SteffPoint Launch",
  "template": "browser-hero",
  "brandKitId": "steffpoint",
  "content": {
    "title": "Cockpit SteffPoint",
    "subtitle": "One cockpit. All my environments."
  },
  "assets": [],
  "layout": {},
  "exportPresets": ["linkedin", "open-graph", "square"]
}
```

Le champ `schemaVersion` permettra de migrer les projets lors des évolutions du modèle de données.

## 9. Brand Kits

Permettre à l'utilisateur de créer plusieurs identités visuelles.

### Propriétés

- nom ;
- logo principal ;
- logo alternatif ;
- couleur primaire ;
- couleurs secondaires ;
- couleurs neutres ;
- police des titres ;
- police du texte ;
- arrondi par défaut ;
- intensité des ombres ;
- thème clair / sombre ;
- style graphique : minimal, soft, bold, editorial.

### Exemple

- ConnectIT
- SteffPoint
- Travel Journal
- Personal Lab

Les templates héritent automatiquement du Brand Kit sélectionné.

## 10. Template Gallery

Prévoir une galerie filtrable :

- App Showcase ;
- Social Media ;
- Browser ;
- Mobile ;
- Product ;
- Documentation ;
- Announcement ;
- Before / After ;
- Editorial ;
- Minimal.

### Templates initiaux recommandés

1. Browser Hero
2. Browser Duo
3. Mobile Trio
4. Bento
5. Spotlight
6. Before / After
7. Editorial
8. Minimal

La priorité est la qualité plutôt que la quantité.

## 11. Templates déclaratifs

À terme, séparer la description du template de son implémentation React lorsque cela est réaliste.

Exemple :

```json
{
  "id": "browser-hero",
  "name": "Browser Hero",
  "category": "browser",
  "slots": {
    "title": true,
    "subtitle": true,
    "logo": true,
    "screenshots": {
      "min": 1,
      "max": 3
    }
  }
}
```

Objectifs :

- faciliter l'ajout de templates ;
- standardiser les propriétés ;
- permettre une galerie dynamique ;
- préparer de futurs templates personnalisés.

## 12. Image Studio

Chaque screenshot dispose de réglages non destructifs :

- Cover / Contain ;
- zoom ;
- déplacement horizontal/vertical ;
- point focal ;
- arrondi ;
- ombre ;
- bordure ;
- rotation légère ;
- masque éventuel.

### Point focal

Le point focal permet de préserver la zone importante lors des déclinaisons entre paysage, carré et portrait.

## 13. Safe Zones

Pour chaque format, afficher lorsque nécessaire :

- zone sûre pour le texte ;
- marges ;
- risque de crop ;
- éléments dépassant du canvas ;
- avertissement si un élément important est trop proche du bord.

## 14. Multi-format Preview

Une même composition doit pouvoir être prévisualisée simultanément en plusieurs ratios :

- LinkedIn ;
- Open Graph ;
- Square ;
- Story ;
- Custom.

Le moteur adapte le layout tout en conservant le point focal et les règles du template.

## 15. Export Studio

### Formats d'image

- PNG ;
- JPEG ;
- WebP.

### Résolutions

- 1× ;
- 2× ;
- 3× lorsque raisonnable.

### Presets

- LinkedIn ;
- Open Graph ;
- Square ;
- Story ;
- GitHub ;
- Product Hunt ;
- Custom.

### Export multiple

L'utilisateur sélectionne plusieurs formats et récupère :

```text
project-name.zip
├── linkedin.png
├── open-graph.png
├── square.png
├── story.png
└── project.json
```

## 16. Undo / Redo

Prévoir un historique local :

- changement de titre ;
- déplacement d'image ;
- changement de crop ;
- changement de couleur ;
- changement de template ;
- modification d'un élément graphique.

Fonctions :

- Undo ;
- Redo ;
- raccourcis clavier ;
- historique limité pour maîtriser la mémoire.

## 17. Variants

Un projet peut contenir plusieurs variantes :

```text
Cockpit Launch
├── Original
├── Dark
├── Minimal
├── LinkedIn
└── Product Hunt
```

Une variante hérite initialement du projet, puis dispose de ses propres modifications.

## 18. Before / After

Template dédié aux transformations :

- refonte SharePoint ;
- nouvelle web part SPFx ;
- redesign d'application ;
- évolution dashboard ;
- avant/après UX.

Fonctions possibles :

- côte à côte ;
- split horizontal ;
- split vertical ;
- slider visuel ;
- légendes Before / After.

## 19. Device Mockup Studio

Mockups proposés :

- Browser ;
- Browser Minimal ;
- Desktop ;
- Laptop ;
- Smartphone générique ;
- iPhone-like générique ;
- Android-like générique ;
- Tablet.

Réglages :

- échelle ;
- rotation ;
- perspective ;
- profondeur ;
- ombre ;
- chevauchement.

Éviter d'utiliser sans vérification des assets commerciaux représentant des appareils ou marques protégés.

## 20. Background Studio

Types de fonds :

- solid ;
- gradient ;
- mesh ;
- pattern ;
- image ;
- soft glow ;
- grid ;
- paper/noise léger.

Réglages :

- couleurs ;
- orientation ;
- intensité ;
- blur ;
- bruit ;
- contraste.

Le nombre de réglages doit rester volontairement limité.

## 21. Asset Manager

Bibliothèque locale réutilisable :

- logos ;
- screenshots ;
- icônes ;
- backgrounds ;
- images diverses.

Fonctions :

- ajout par drag & drop ;
- renommage ;
- tags ;
- recherche ;
- suppression ;
- réutilisation entre projets.

Stockage recommandé : IndexedDB.

## 22. Accessibility Checker

Contrôles automatiques :

- contraste texte/fond ;
- WCAG AA lorsqu'applicable ;
- taille minimale du texte ;
- éléments trop proches des bords ;
- chevauchements problématiques ;
- lisibilité sur miniature.

Les alertes doivent rester informatives et ne pas bloquer l'export.

## 23. Smart Suggestions sans IA

Avant d'introduire un LLM, développer des règles déterministes :

- titre trop long ;
- trop de lignes ;
- faible contraste ;
- mauvais template pour l'orientation des screenshots ;
- image trop petite pour l'export ;
- texte trop proche du bord ;
- proposition d'un template mieux adapté ;
- suggestion de taille de police.

Avantages : rapidité, coût nul, confidentialité et prévisibilité.

## 24. Fonctions IA futures

L'IA est une évolution, pas une dépendance du MVP.

Fonctions possibles :

- proposer plusieurs titres ;
- raccourcir un message ;
- générer un sous-titre ;
- traduction FR / NL / EN ;
- proposer une catégorie de template ;
- proposer une composition ;
- suggérer une palette ;
- générer des variantes éditoriales ;
- fournir du texte adapté à LinkedIn, GitHub ou Product Hunt.

Toujours distinguer les traitements purement locaux des contenus envoyés vers un service IA externe.

## 25. Batch Generator

Importer un CSV/JSON et produire un ensemble de visuels automatiquement.

Exemple :

```csv
title,subtitle,image,color
Cockpit,Your digital workspace,cockpit.png,#0078D4
Travel,Remember your journeys,travel.png,#FF7800
PromptLib,Your Copilot prompts,prompts.png,#742774
```

Le moteur peut générer plusieurs formats pour chaque ligne.

Cas d'usage :

- catalogue produit ;
- série LinkedIn ;
- documentation ;
- actualités ;
- campagnes ;
- open source releases.

## 26. Capture d'URL

Fonction optionnelle permettant de capturer une page web.

### Architecture

Cette fonction doit rester séparée du cœur local-first, car une capture automatisée d'URL nécessite généralement un environnement serveur ou un navigateur headless.

Options :

- Azure Functions + navigateur headless compatible ;
- service Node.js dédié ;
- Vercel Function ;
- autre service spécialisé.

### Sécurité

Prévoir :

- validation stricte des URL ;
- protections SSRF ;
- blocage des réseaux privés/localhost ;
- limites de taille et temps ;
- restrictions de protocoles ;
- rate limiting ;
- journalisation limitée ;
- information explicite indiquant que l'URL quitte le navigateur.

## 27. API de rendu

Évolution future : exposer le moteur de rendu via API.

```http
POST /api/render
```

Exemple conceptuel :

```json
{
  "template": "linkedin-launch",
  "title": "Cockpit SteffPoint",
  "brandKit": "steffpoint",
  "format": "linkedin"
}
```

Cas d'usage :

- CMS ;
- GitHub Actions ;
- Azure DevOps ;
- publication automatisée ;
- génération Open Graph ;
- pipelines de documentation.

Cette fonction implique un backend, de l'authentification, des quotas et une réflexion sur les coûts de rendu.

## 28. Intégrations CMS

Évolutions envisageables :

- WordPress ;
- Strapi ;
- Contentful ;
- Sanity ;
- CMS interne ;
- webhook générique ;
- GitHub Actions.

Objectif : créer automatiquement un visuel lors de la publication d'un contenu.

## 29. Architecture proposée

```text
steffpoint-visual-studio/
├── apps/
│   └── web/
├── packages/
│   ├── visual-core/
│   ├── visual-renderer/
│   ├── templates/
│   ├── brand-kit/
│   └── shared-types/
├── services/
│   ├── capture/          # optionnel
│   ├── render-api/       # futur
│   └── ai/               # futur
├── docs/
├── LICENSE
├── THIRD_PARTY_NOTICES.md
└── README.md
```

### `visual-core`

- modèle Project ;
- modèle Brand Kit ;
- modèles de données ;
- règles ;
- formats ;
- layouts ;
- validation ;
- migrations de schéma.

### `visual-renderer`

- rendu ;
- screenshots ;
- crop ;
- mockups ;
- backgrounds ;
- exports.

### `apps/web`

- dashboard ;
- editor ;
- project manager ;
- template gallery ;
- asset manager ;
- brand kits ;
- export studio.

## 30. Stack technique recommandée

À valider en fonction du code repris, mais la cible logique reste :

- TypeScript ;
- React ;
- Next.js pour l'application web ;
- Zustand ou store équivalent léger ;
- IndexedDB ;
- modern-screenshot ou moteur de rendu DOM équivalent après tests ;
- dnd-kit pour les interactions drag & drop ;
- Tailwind CSS ;
- composants UI accessibles ;
- Vitest pour les tests unitaires ;
- Playwright pour l'E2E.

## 31. Confidentialité et approche local-first

Principe architectural majeur :

> Les screenshots et images restent dans le navigateur sauf lorsqu'une fonction nécessite explicitement un service distant.

### Local

- édition ;
- crop ;
- templates ;
- Brand Kits ;
- assets ;
- projets ;
- export ;
- génération ZIP.

### Externe uniquement lorsque nécessaire

- capture d'URL ;
- IA ;
- synchronisation cloud ;
- collaboration ;
- API de rendu serveur.

L'interface doit indiquer clairement lorsqu'une opération quitte l'appareil.

## 32. Sécurité

Points à traiter :

- validation des fichiers importés ;
- limitation de taille ;
- prévention des fichiers malformés ;
- sanitation des contenus textuels ;
- CSP lorsque possible ;
- dépendances npm supervisées ;
- protections SSRF du service de capture ;
- aucune clé API sensible dans le frontend ;
- authentification si des services cloud sont ajoutés ;
- politique de rétention minimale côté serveur.

## 33. Performance

Mesures recommandées :

- lazy loading des templates ;
- génération différée des previews ;
- compression raisonnable des miniatures ;
- Web Workers pour certains traitements lourds si nécessaire ;
- URL objets (`URL.createObjectURL`) pour les blobs ;
- révocation correcte des URL objets ;
- éviter les copies Base64 inutiles ;
- limiter l'historique Undo/Redo ;
- tests avec screenshots haute résolution.

## 34. Responsive UX

Priorité : desktop pour l'éditeur complet.

### Desktop

- édition complète ;
- galerie ;
- multi-preview ;
- drag & drop avancé.

### Tablet

- édition simplifiée mais fonctionnelle.

### Mobile

- consultation des projets ;
- modifications simples ;
- export ;
- éviter de vouloir reproduire tout l'éditeur desktop sur un petit écran.

## 35. Dashboard

Écran d'accueil proposé :

```text
SteffPoint Visual Studio

[ + New Project ]

Recent Projects
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Cockpit      │ │ Travel App   │ │ SP Dashboard │
└──────────────┘ └──────────────┘ └──────────────┘

Templates
Browser | Mobile | Social | Product | More

Brand Kits
SteffPoint | ConnectIT | Travel
```

## 36. Editor UX

Disposition desktop recommandée :

```text
┌─────────────────────────────────────────────────────────────┐
│ Project | Undo Redo | Preview | Export                    │
├───────────────┬────────────────────────────┬────────────────┤
│ Assets        │                            │ Properties     │
│ Templates     │          CANVAS            │ Content        │
│ Brand         │                            │ Layout         │
│ Background    │                            │ Image          │
│ Variants      │                            │ Style          │
├───────────────┴────────────────────────────┴────────────────┤
│ LinkedIn | OG | Square | Story | GitHub                    │
└─────────────────────────────────────────────────────────────┘
```

Limiter les panneaux au nécessaire et utiliser une divulgation progressive des options avancées.

## 37. Raccourcis clavier

Prévoir notamment :

- `Ctrl/Cmd + Z` : Undo ;
- `Ctrl/Cmd + Shift + Z` : Redo ;
- `Ctrl/Cmd + S` : sauvegarde ;
- `Ctrl/Cmd + D` : dupliquer ;
- `Delete` : supprimer une sélection ;
- `Esc` : fermer/quitter le mode courant.

## 38. MVP V1 — Better Cover Studio

### Objectif

Transformer le projet d'origine en véritable application réutilisable sans complexifier excessivement l'expérience.

### Fonctionnalités

- Project Manager ;
- IndexedDB ;
- sauvegarde automatique ;
- import/export JSON ;
- 8 templates qualitatifs ;
- screenshot upload ;
- crop ;
- zoom ;
- point focal ;
- titre/sous-titre ;
- logo ;
- palette ;
- Undo/Redo ;
- Safe Zones ;
- formats personnalisés ;
- PNG/JPEG/WebP ;
- export ZIP ;
- presets LinkedIn/Open Graph/Square/Story/GitHub.

### Effort indicatif

**Moyen à élevé : environ 3 à 6 semaines** pour une V1 propre selon le niveau de reprise du code, le nombre de templates adaptés et la profondeur des tests.

## 39. V2 — Visual Studio

### Fonctionnalités

- Brand Kits ;
- Asset Manager ;
- Template Gallery enrichie ;
- variants ;
- Before/After ;
- Background Studio ;
- nouveaux mockups ;
- accessibilité ;
- prévisualisation multi-format simultanée ;
- meilleurs comportements responsives ;
- smart suggestions déterministes.

### Effort indicatif

**Élevé : 4 à 8 semaines supplémentaires**, selon l'ambition UX et le moteur de templates.

## 40. V3 — Visual Platform

### Fonctionnalités

- compte utilisateur ;
- synchronisation cloud ;
- partage ;
- équipes ;
- Brand Kits organisationnels ;
- templates partagés ;
- Batch Generator ;
- capture d'URL ;
- intégrations CMS ;
- API de rendu ;
- Open Graph automatisé ;
- fonctions IA.

Cette phase transforme l'application locale en plateforme et nécessite une architecture backend complète.

## 41. Priorités produit

| Priorité | Fonction | Valeur | Complexité |
|---|---|---|---|
| 1 | Projects | Très élevée | Moyenne |
| 2 | Crop + focal point | Très élevée | Moyenne |
| 3 | Multi-format export | Très élevée | Moyenne |
| 4 | Brand Kits | Élevée | Moyenne |
| 5 | Template Gallery | Élevée | Moyenne |
| 6 | JSON import/export | Élevée | Faible |
| 7 | Undo/Redo | Élevée | Moyenne |
| 8 | Safe Zones | Moyenne/élevée | Faible |
| 9 | Asset Manager | Élevée | Moyenne |
| 10 | Variants | Élevée | Moyenne |
| 11 | Batch Generator | Élevée | Élevée |
| 12 | CMS integrations | Moyenne | Élevée |
| 13 | Render API | Élevée | Élevée |
| 14 | URL Capture | Moyenne | Élevée |
| 15 | AI | Variable | Élevée |

## 42. Ce qui doit rester hors MVP

- comptes utilisateurs ;
- paiement ;
- collaboration temps réel ;
- API publique ;
- IA ;
- capture d'URL complexe ;
- CMS ;
- batch massif ;
- éditeur vectoriel libre ;
- animation avancée.

## 43. Critères de réussite de la V1

La V1 est réussie si un utilisateur peut :

1. lancer l'application sans créer de compte ;
2. créer un projet en moins d'une minute ;
3. importer 1 à 4 screenshots ;
4. appliquer sa marque ;
5. obtenir un rendu qualitatif sans compétences graphiques ;
6. décliner la composition dans plusieurs formats ;
7. exporter le tout en une action ;
8. fermer puis rouvrir l'application sans perdre son projet ;
9. savoir clairement qu'aucune image n'a quitté son appareil.

## 44. Évolutions possibles spécifiques à Microsoft 365

Sans transformer le cœur du produit en solution Microsoft 365, l'architecture peut ultérieurement permettre :

- importer une image depuis SharePoint ;
- sauvegarder un export dans une bibliothèque SharePoint ;
- générer une bannière d'actualité ;
- produire une vignette documentaire ;
- récupérer un Brand Kit organisationnel ;
- utiliser Microsoft Graph avec consentement explicite ;
- intégrer une édition adaptée dans Teams ou SharePoint.

Ces intégrations doivent rester des adaptateurs autour du moteur principal plutôt que des dépendances du `visual-core`.

## 45. Idées avec le meilleur rapport valeur / effort

### 1. Projects + sauvegarde locale

Transforme immédiatement un générateur ponctuel en application réellement réutilisable.

### 2. Multi-format Export

Une composition produit plusieurs livrables. C'est probablement la promesse produit la plus forte.

### 3. Crop + Focal Point

Améliore fortement la qualité des déclinaisons et évite les cadrages cassés.

### 4. Brand Kits

Apporte cohérence, rapidité et véritable intérêt pour les utilisateurs réguliers.

### 5. Export JSON + ZIP

Simple techniquement comparativement à sa valeur : portabilité, backup et partage facilité des projets.

## 46. Direction produit recommandée

SteffPoint Visual Studio doit rester un **outil spécialisé de production visuelle**, et non devenir un éditeur graphique généraliste.

Sa différenciation peut reposer sur quatre principes :

1. **Rapidité** : partir de screenshots et produire un résultat rapidement.
2. **Cohérence** : Brand Kits et templates maîtrisés.
3. **Déclinaison** : créer une fois, publier partout.
4. **Confidentialité** : local-first par défaut.

### Signature produit proposée

> **Create once. Publish everywhere.**

### Résumé

```text
Screenshots + Brand + Content
              ↓
       Visual Project
              ↓
       Template Engine
              ↓
      Responsive Layouts
              ↓
 LinkedIn | OG | Square | Story | GitHub | Custom
              ↓
          Export Pack
```

Cette direction fournit un produit clairement distinct : plus structuré qu'un simple générateur de cover, mais volontairement beaucoup plus simple qu'un outil de design complet.
