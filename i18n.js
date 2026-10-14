/* Traduction anglaise du CRM — DEUX langues indépendantes :
     - la langue de l'INTERFACE (ce que Melissa lit à l'écran), réglée par appareil ;
     - la langue du DEVIS (ce que le client lit), réglée devis par devis.
   Ce fichier ne contient que des données (dictionnaires) et deux fonctions pures, sans DOM :
   le moteur qui les applique est dans index.html.

   Règle d'extension : pour traduire un texte de plus, ajouter UNE ligne « français : anglais »
   dans UI_EN (écran) ou DV_EN (contenu d'un devis). Un texte absent du dictionnaire reste en
   français — jamais de texte cassé. `__trManquants()` (console) liste ce qui reste à traduire
   sur l'écran en cours. */
(function(root){
'use strict';

/* Une apostrophe droite et une apostrophe courbe sont la même chose pour le dictionnaire. */
function norm(s){return String(s).replace(/[’‘]/g,"'").replace(/ /g,' ').replace(/\s+/g,' ').trim();}

/* ====================== LIBELLÉS FIXES DU DEVIS (document remis au client) ====================== */
const DV_LABELS={
  fr:{
    devis:'Devis',facture:'Facture',no:'N°',date:'Date',tel:'Tél',
    destine:'Destiné à',societe:'N° société',projet:'Projet',adresse:'Adresse',
    surDevis:'sur devis',optOui:'Oui, je valide cette option',optNon:'Non',
    hors:'Hors prestation',
    partenaires:'Des partenaires spécialisés peuvent être recommandés selon les besoins du projet.',
    htGlobal:'Honoraires — forfait global (H.T.)',htTotal:'Montant total H.T.',
    tvaNA:'TVA (non applicable)',tva:'TVA',ttc:'Total T.T.C.',
    tvaNote:'TVA non applicable — à confirmer avec le comptable.',
    deroulement:'Déroulement',signature:'Signature',signatureClient:'Signature client',
    cgv:'Conditions générales',
    mailBonjour:'Bonjour',mailJoint:'Veuillez trouver ci-joint',leDevis:'le devis',laFacture:'la facture',
    mailPourProjet:'pour le projet',mailPdf:'(pensez à joindre le PDF téléchargé — un email ne peut pas joindre de fichier automatiquement)',
    waPdf:'(pensez à joindre le PDF téléchargé — WhatsApp Web ne permet pas de le joindre automatiquement)',
    cordialement:'Cordialement',
    locale:'fr-FR'
  },
  en:{
    devis:'Quote',facture:'Invoice',no:'No.',date:'Date',tel:'Tel',
    destine:'Prepared for',societe:'Company no.',projet:'Project',adresse:'Address',
    surDevis:'on quote',optOui:'Yes, I approve this option',optNon:'No',
    hors:'Not included',
    partenaires:'Specialist partners can be recommended depending on the needs of the project.',
    htGlobal:'Fees — fixed package (excl. VAT)',htTotal:'Total excl. VAT',
    tvaNA:'VAT (not applicable)',tva:'VAT',ttc:'Total incl. VAT',
    tvaNote:'VAT not applicable — to be confirmed with the accountant.',
    deroulement:'Schedule',signature:'Signature',signatureClient:'Client signature',
    cgv:'General terms and conditions',
    mailBonjour:'Hello',mailJoint:'Please find attached',leDevis:'the quote',laFacture:'the invoice',
    mailPourProjet:'for the project',mailPdf:'(remember to attach the downloaded PDF — an email cannot attach a file automatically)',
    waPdf:'(remember to attach the downloaded PDF — WhatsApp Web cannot attach it automatically)',
    cordialement:'Kind regards',
    locale:'en-US'
  }
};
function dvLang(S){return (S&&S.lang==='en')?'en':'fr';}
/* Libellé d'un devis dans SA langue (jamais celle de l'interface). */
function dvLabel(S,key){const L=DV_LABELS[dvLang(S)];return (L&&L[key]!=null)?L[key]:DV_LABELS.fr[key];}

/* ====================== CONTENU STANDARD DU DEVIS : français -> anglais ======================
   Catégories, prestations, « hors prestation » et conditions générales livrées d'origine.
   Ce que Melissa a écrit elle-même n'est pas dans cette liste : il reste tel qu'elle l'a tapé
   (le devis le garde en français, et l'écran « Langue du devis » le dit). */
const DV_EN={
  'Conseil':'Consultation','Conception':'Design','3D':'3D','Technique':'Technical','Administratif':'Administrative',
  'Chiffrage':'Costing','Chantier':'Site works','Compléments':'Additional services',
  "1er rdv explication du projet":'First meeting: project briefing',
  'Visite sur site':'Site visit',
  'Analyse des besoins':'Needs analysis',
  "Étude et organisation des espaces : bar, assises, zone d'accueil, circulation.":'Study and organisation of the spaces: bar, seating, reception area, circulation.',
  'Étude de faisabilité':'Feasibility study',
  "Conception du concept décoratif et de l'ambiance générale.":'Design of the decorative concept and the overall atmosphere.',
  "Relevé de l'existant":'Survey of the existing premises',
  'Esquisse / croquis':'Sketch / drawings',
  'Plans 2D':'2D plans',
  'Coupes / façades':'Sections / elevations',
  'Projet détaillé':'Detailed design',
  "Plan d'aménagement intérieur":'Interior layout plan',
  'Modélisation 3D':'3D modelling','Vues 3D':'3D views','Rendus photoréalistes':'Photorealistic renders',
  'Création de 3 à 4 rendus 3D photoréalistes pour visualiser le projet.':'Creation of 3 to 4 photorealistic 3D renders to visualise the project.',
  "Plans techniques d'exécution":'Technical construction drawings',
  "Réalisation des plans techniques destinés à l'entrepreneur : côtes, agencement, électricité, éclairage, plans détaillés, plomberie.":'Production of the technical drawings for the contractor: dimensions, layout, electrical, lighting, detailed plans, plumbing.',
  'Plans électriques':'Electrical plans','Plans plomberie':'Plumbing plans',
  'Détails de menuiserie / mobilier':'Joinery / furniture details',
  'Dossier permis construction / entreprise':'Building permit / business licence file',
  'Déclaration préalable':'Prior declaration','Dépôt du dossier':'Filing of the application','Autorisation de travaux':'Works authorisation',
  'Devis quantitatif et estimatif':'Bill of quantities and cost estimate',
  'Demandes de 2 devis min. par corps de métier':'Request of at least 2 quotes per trade',
  'Analyse des devis':'Analysis of the quotes',
  'Coordination de projet (par semaine)':'Project coordination (per week)',
  'Réunions de chantier':'Site meetings',
  'Visites de chantier (par semaine)':'Site visits (per week)',
  'Compte rendu de chantier (par semaine)':'Site report (per week)',
  'Suivi des travaux':'Works supervision',
  "Le suivi de chantier consiste à vérifier la bonne mise en œuvre du projet et à accompagner le client pendant la phase de travaux. Des ajustements mineurs peuvent être pris en compte en cours de réalisation, tant qu'ils ne modifient pas la conception initiale. Ce suivi ne comprend pas la gestion complète des prestataires ni la coordination quotidienne, qui restent sous la responsabilité du client.":
    "Site supervision consists of checking that the project is carried out correctly and supporting the client during the works phase. Minor adjustments can be taken into account during execution, as long as they do not change the initial design. This supervision does not include the full management of the contractors or the day-to-day coordination, which remain the client's responsibility.",
  'Estimation budgétaire':'Budget estimate',
  'Une estimation budgétaire détaillée des travaux, menuiseries, matériaux et mobilier est fournie pour planifier le projet avec précision.':'A detailed budget estimate of the works, joinery, materials and furniture is provided so that the project can be planned precisely.',
  'Sélection matériaux (2 jours)':'Materials selection (2 days)',
  'Sélection des matériaux, couleurs et revêtements.':'Selection of materials, colours and finishes.',
  'Sélection mobilier & luminaires':'Furniture and lighting selection',
  "Accompagnement dans les choix, jusqu'à deux visites incluses.":'Guidance in making choices, up to two visits included.',
  'Décoration':'Decoration',
  'Commandes chez prestataires':'Orders with suppliers',
  'Détails des prestataires : ':'Supplier details: ',
  'Réception / vérification de la marchandise':'Receiving / checking the goods',
  'Détails de la marchandise : ':'Goods details: ',
  'Gestion du projet de A à Z':'Project management from A to Z',
  'Travail express':'Express work',
  'Honoraires des prestataires et corps de métier (facturés séparément)':'Fees of the contractors and trades (invoiced separately)',
  "Consultants externes / bureaux d'études / ingénieurs":'External consultants / engineering firms / engineers',
  'Coordination quotidienne des prestataires (reste sous la responsabilité du client)':'Day-to-day coordination of the contractors (remains the responsibility of the client)',
  /* Conditions générales d'origine */
  '1. Objet du contrat.':'1. Purpose of the contract.',
  "Les présentes conditions générales de vente régissent les relations contractuelles entre l'architecte et le client, définissant les droits et obligations de chaque partie.":'These general terms and conditions of sale govern the contractual relationship between the architect and the client, defining the rights and obligations of each party.',
  "2. Prestations de l'architecte.":"2. The architect's services.",
  "L'architecte s'engage à fournir des services de conception, de planification et de supervision des travaux conformément aux normes professionnelles en vigueur.":'The architect undertakes to provide design, planning and works supervision services in accordance with the professional standards in force.',
  '3. Honoraires et modalités de paiement.':'3. Fees and payment terms.',
  "Les honoraires sont fixés selon une prestation globale. Les paiements s'effectuent selon les modalités suivantes :\n- 30 % à la signature du contrat\n- 40 % à la remise des plans définitifs (après validation de la liste des quantités des matériaux)\n- 30 % à la fin des travaux si la prestation de suivi de chantier est prise":
    'The fees are set as a global package. Payments are made as follows:\n- 30% on signature of the contract\n- 40% on delivery of the final plans (after approval of the list of material quantities)\n- 30% at the end of the works if the site supervision service is taken',
  '4. Obligations des parties.':'4. Obligations of the parties.',
  "Le client fournit toutes les informations nécessaires et respecte les délais de paiement. L'architecte respecte les délais de réalisation. Les plans sont validés en commun avant transmission au maître d'œuvre et aux prestataires.":'The client provides all the necessary information and respects the payment deadlines. The architect respects the delivery deadlines. The plans are approved jointly before being sent to the project manager and the contractors.',
  '5. Modifications et révisions.':'5. Changes and revisions.',
  'Toute modification du projet initial validé pourra faire l\'objet d\'un avenant précisant les nouvelles conditions financières et les délais supplémentaires éventuels.':'Any change to the initial approved project may be covered by an amendment specifying the new financial terms and any additional time required.',
  '6. Responsabilité et assurance.':'6. Liability and insurance.',
  "L'architecte met en œuvre tous les moyens nécessaires à la bonne exécution des prestations. Les prestataires doivent disposer d'une assurance responsabilité civile professionnelle.":'The architect uses all the means necessary for the proper performance of the services. The contractors must hold professional liability insurance.',
  '7. Résiliation.':'7. Termination.',
  "En cas de résiliation par l'une des parties, un préavis de 30 jours est requis. Les honoraires dus pour les prestations réalisées restent exigibles.":'If either party terminates the contract, 30 days\' notice is required. The fees due for the services already performed remain payable.',
  '8. Clause de non-responsabilité.':'8. Disclaimer.',
  "L'architecte ne pourra être tenu responsable d'un arrêt des travaux pour des raisons indépendantes de sa volonté (météo, décisions administratives, situation de guerre, financement du client ou défaillance d'un entrepreneur).":'The architect cannot be held liable for a halt in the works for reasons beyond his or her control (weather, administrative decisions, war situation, the client\'s financing or the failure of a contractor).',
  '9. Frais administratifs et prestataires externes.':'9. Administrative costs and external contractors.',
  "Les frais administratifs et les coûts des prestataires externes (ingénieurs, consultants, etc.) ne sont pas inclus dans les honoraires et sont facturés séparément.":'Administrative costs and the costs of external contractors (engineers, consultants, etc.) are not included in the fees and are invoiced separately.',
  '10. Litiges et juridiction.':'10. Disputes and jurisdiction.',
  "En cas de litige, les parties recherchent une solution amiable. À défaut, le tribunal compétent sera celui du lieu de résidence de l'architecte.":"In the event of a dispute, the parties will seek an amicable solution. Failing that, the competent court will be the one in the architect's place of residence."
};
const _dvIndex=new Map(Object.keys(DV_EN).map(k=>[norm(k),DV_EN[k]]));
/* Texte standard d'un devis dans la langue du devis. Un texte saisi à la main (absent du
   dictionnaire) est rendu tel quel. */
function dvTr(S,text){
  if(dvLang(S)!=='en'||text==null)return text;
  const hit=_dvIndex.get(norm(text));
  return hit!=null?hit:text;
}

/* ====================== INTERFACE : français -> anglais ====================== */
const UI_EN={
  /* connexion */
  'Connexion à votre espace':'Sign in to your workspace','Se connecter':'Sign in','E-mail':'Email','Mot de passe':'Password',
  /* barre du haut, navigation */
  'Tableau de bord':'Dashboard','Tableau':'Dashboard','Devis':'Quotes','Clients':'Clients','Réalisations':'Portfolio','Boutique':'Shop',
  '📝 Composer':'📝 Compose','📂 Mes devis':'📂 My quotes','📐 Estimation du Projet':'📐 Project estimate',
  '📝 Composer un devis':'📝 Compose a quote',
  '📱 Mobile':'📱 Mobile','🖥 Bureau':'🖥 Desktop','⚙ Réglages':'⚙ Settings','Sauvegarde':'Backup','💾 Sauvegarde':'💾 Backup','🔄 Synchronisation':'🔄 Sync',
  'Synchronisation':'Sync','Plus':'More','Rechercher':'Search','Rechercher (Ctrl+K)':'Search (Ctrl+K)','Plus d’actions':'More actions',
  '👁 Aperçu':'👁 Preview','Diagnostic synchro':'Sync diagnostics','Navigation principale':'Main navigation','Vue':'View',
  /* éditeur de devis */
  'Gérer le devis':'Manage the quote','Produire & envoyer':'Produce & send',
  '🆕 Nouveau Devis':'🆕 New quote','📝 Enregistrer brouillon':'📝 Save draft','💾 Enregistrer Devis':'💾 Save quote','📋 Édition des services':'📋 Edit services',
  '🧾 Convertir en facture':'🧾 Convert to invoice','↺ Repasser en devis':'↺ Back to quote','🖨 Imprimer PDF':'🖨 Print PDF',
  '📧 Envoyer par email':'📧 Send by email','Envoyer par WhatsApp':'Send by WhatsApp',
  'N° de devis':'Quote no.','Date':'Date','Langue du devis':'Quote language',
  'Client':'Client','Raison sociale / nom':'Company / name','Contact':'Contact','Téléphone':'Phone','Email':'Email','Adresse':'Address',
  'N° société':'Company no.','Ville':'City','Code postal':'Postcode',
  'Projet':'Project','Intitulé du projet':'Project title','Surface (m²)':'Area (m²)','Adresse du projet':'Project address',"Texte d'introduction":'Introduction text',
  'Tarification':'Pricing','Forfait global':'Fixed package','Détail par prestation':'Itemised pricing','Montant global':'Global amount','Ce montant est':'This amount is',
  'H.T.':'excl. VAT','T.T.C.':'incl. VAT',
  'Prestations · cochez ce qui est inclus':'Services · tick what is included','Hors prestation · non compris':'Not included',
  'Déroulement (optionnel)':'Schedule (optional)','Afficher un calendrier indicatif':'Show an indicative schedule','Étapes (une par ligne)':'Steps (one per line)',
  'TVA & options':'VAT & options','Taux de TVA (%)':'VAT rate (%)','Devise':'Currency','₪ (Shekel)':'₪ (Shekel)','€ (Euro)':'€ (Euro)','$ (Dollar)':'$ (Dollar)',
  'Facturation hors Israël — TVA non applicable':'Billing outside Israel — VAT not applicable',
  'Inclure les conditions générales':'Include the general terms and conditions','✎ Modifier':'✎ Edit',
  'Signature client':'Client signature','Signataire différent de la raison sociale (personne physique)':'Signatory different from the company name (individual)',
  'Nom du signataire':'Signatory name','✎ Faire signer le client':'✎ Have the client sign','Effacer la signature':'Clear the signature',
  '+ Ajouter une ligne':'+ Add a line','+ Ajouter un élément':'+ Add an item','Intitulé':'Title','Élément non compris':'Item not included','Supprimer':'Delete',
  'Inclus (sans prix)':'Included (no price)','Prix fixe':'Fixed price','Quantité × P.U.':'Quantity × unit price','Prix / m²':'Price / m²','Sur devis':'On quote',
  'Qté':'Qty',
  /* actions communes */
  'Annuler':'Cancel','Confirmer':'Confirm','Enregistrer':'Save','Fermer':'Close','Modifier':'Edit','Ouvrir':'Open','Retirer':'Remove','Valider':'Approve',
  'Oui':'Yes','Non':'No','Chargement…':'Loading…','Aucun client trouvé.':'No client found.','Rechercher un client…':'Search for a client…',
  'Enregistrer le devis':'Save the quote','Nom du devis':'Quote name','…ou attribuer à un client existant':'…or assign to an existing client',
  '→ Sans client pour l\'instant.':'→ No client for now.',
  'Attribuer à un client':'Assign to a client','Mes devis':'My quotes','Mes estimations':'My estimates',
  'Brouillon':'Draft','Validé':'Approved','Facture':'Invoice','En attente':'Pending','Accepté':'Accepted','Refusé':'Declined',
  /* réglages */
  'Réglages':'Settings','Tout ce qui apparaît sur tes devis — modifiable ici, sans toucher au code.':'Everything that appears on your quotes — editable here, no code needed.',
  'Langues':'Languages','Langue de l’interface':'Interface language','Langue par défaut des nouveaux devis':'Default language of new quotes',
  'Français':'French','English':'English',
  'Ce que tu lis à l’écran. Réglé sur cet appareil.':'What you read on screen. Set on this device.',
  'Chaque devis peut ensuite changer de langue dans l’éditeur. Indépendante de l’interface.':'Each quote can then change language in the editor. Independent of the interface.',
  'Identité':'Identity',"Nom de l'entreprise":'Company name','Coordonnées':'Contact details','Réseau social':'Social network',
  'Intitulé de la licence':'Licence label','Numéro de société / licence':'Company / licence number','Mentions régionales':'Regional mentions',
  'Devis — valeurs par défaut':'Quotes — default values','Devise par défaut':'Default currency','TVA par défaut (%)':'Default VAT (%)',
  '1er n° de devis':'First quote no.','Préfixe des n° de devis':'Quote number prefix','Couleurs du devis':'Quote colours',
  'Depuis une photo…':'From a photo…',"S'applique uniquement au devis imprimé.":'Applies to the printed quote only.',
  'Typographie du devis':'Quote typography','Raccourcis':'Shortcuts','Couleurs de l\'application':'App colours',
  'Bibliothèque & Hors prestation':'Library & Not included','Conditions générales':'General terms and conditions','Catégories de chantier':'Site categories',
  'Photos & retouche IA':'Photos & AI retouching','Rédaction IA — consommation':'AI writing — usage','↺ Tout réinitialiser':'↺ Reset everything',
  'Réglages enregistrés':'Settings saved',
  /* tableau de bord */
  'Mes tâches':'My tasks','+ Nouvelle tâche':'+ New task','🔍 Filtrer':'🔍 Filter','↑ Ordre':'↑ Order','⚙ Catégories':'⚙ Categories','Assistant · à faire':'Assistant · to do',
  'Nouvelle tâche':'New task','Catégories de tâches':'Task categories',
  /* estimation */
  'Estimation du Projet':'Project estimate','Catégories':'Categories','Nouvelle estimation':'New estimate','Résumé par catégorie':'Summary by category',
  'Total général':'Grand total','+ Ajouter une catégorie':'+ Add a category',
  /* réalisations / boutique */
  '📷 Bien photographier':'📷 Photo tips','⚙ Le site public':'⚙ The public website','🌐 Voir le site':'🌐 View the site','+ Nouvelle réalisation':'+ New project',
  '+ Nouveau produit':'+ New product','Le site public':'The public website',
  /* clients */
  'Clients & comptes':'Clients & accounts','⬇ Export CSV':'⬇ Export CSV','⬆ Import CSV':'⬆ Import CSV','⚙ Statuts':'⚙ Statuses','+ Nouveau client':'+ New client',
  'Cliquez sur un en-tête de colonne pour trier ↑↓':'Click a column header to sort ↑↓','Statuts clients':'Client statuses',
  'En cours':'In progress','Devis envoyé':'Quote sent','Terminé':'Done','Annulé':'Cancelled',
  /* sauvegarde / divers */
  'Sauvegarde des données':'Data backup','Bibliothèque':'Library','Réglages — Photos & retouche IA':'Settings — Photos & AI retouching',
  'Rédaction IA — ce qu’elle a coûté':'AI writing — what it cost',
  /* Réglages › Application (installer le CRM comme une application) */
  'Application':'Application',
  'Installe le CRM sur cet appareil : il s’ouvre dans sa propre fenêtre, avec son icône, comme une application. Comme dans le navigateur, il faut internet pour s’en servir.':'Install the CRM on this device: it opens in its own window, with its own icon, like an app. As in the browser, you need internet to use it.',
  'Installer l’application':'Install the app','Installation…':'Installing…',
  'Application installée ✓':'App installed ✓',
  'Tu utilises déjà le CRM en mode application.':'You are already using the CRM as an app.',
  'Ouvre-la depuis son icône « CRM Melissa », sur ton écran d’accueil ou dans tes applications.':'Open it from its “CRM Melissa” icon, on your home screen or in your apps.',
  'Sur iPhone et iPad, l’installation se fait depuis Safari :':'On iPhone and iPad, install from Safari:',
  'Touche l’icône Partager (le carré avec une flèche vers le haut).':'Tap the Share icon (the square with an arrow pointing up).',
  'Choisis « Sur l’écran d’accueil », puis « Ajouter ».':'Choose “Add to Home Screen”, then “Add”.',
  'Ton navigateur peut installer l’application depuis son menu :':'Your browser can install the app from its menu:',
  'Ouvre le menu du navigateur (les trois points).':'Open the browser menu (the three dots).',
  'Choisis « Installer l’application » (ou « Ajouter à l’écran d’accueil »).':'Choose “Install app” (or “Add to Home screen”).',
  'Sur ordinateur, tu peux aussi cliquer sur l’icône d’installation, à droite de la barre d’adresse. Si l’application est déjà installée ici, ouvre-la depuis son icône.':'On a computer, you can also click the install icon at the right of the address bar. If the app is already installed here, open it from its icon.',
  'Ce navigateur ne sait pas installer l’application. Ouvre le CRM dans Chrome (Android ou ordinateur) ou dans Safari (iPhone et iPad), puis reviens ici.':'This browser cannot install the app. Open the CRM in Chrome (Android or computer) or in Safari (iPhone and iPad), then come back here.',
  'Installation annulée.':'Installation cancelled.','Installation annulée':'Installation cancelled','Installation impossible':'Installation failed',
  /* messages */
  'Converti en facture':'Converted to an invoice','Repassé en devis':'Back to a quote','Texte généré':'Text generated','Réponse vide':'Empty reply',
  'Mobile':'Mobile','Bureau':'Desktop'
};
const _uiIndex=new Map(Object.keys(UI_EN).map(k=>[norm(k),UI_EN[k]]));
/* Motifs avec un nombre ou un nom dedans (texte construit par l'application). */
const UI_PATTERNS=[
  [/^Aperçu ouvert — bouton « Imprimer \/ Enregistrer en PDF »$/,()=>'Preview opened — use the “Print / Save as PDF” button'],
  [/^Réglages remis à zéro$/,()=>'Settings reset'],
  [/^(\d+) devis$/,(m)=>m[1]+' quotes'],
  [/^Installation impossible \((.*)\)\. Essaie par le menu du navigateur\.$/,(m)=>'Installation failed ('+m[1]+'). Try from the browser menu.']
];
/* Traduit un texte d'écran ; renvoie null s'il n'est pas dans le dictionnaire. */
function uiTr(text){
  if(text==null)return null;
  const n=norm(text);
  if(!n)return null;
  const hit=_uiIndex.get(n);
  if(hit!=null)return hit;
  for(let i=0;i<UI_PATTERNS.length;i++){const m=UI_PATTERNS[i][0].exec(n);if(m)return UI_PATTERNS[i][1](m);}
  return null;
}

const api={norm,DV_LABELS,DV_EN,UI_EN,dvLang,dvLabel,dvTr,uiTr};
root.I18N=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
