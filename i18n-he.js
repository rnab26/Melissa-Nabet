/* Traduction hébraïque du CRM (sens de lecture de droite à gauche).
   Même principe que l'anglais (i18n.js) : DEUX langues indépendantes — celle de l'INTERFACE
   (réglée par appareil) et celle du DEVIS (réglée devis par devis) — et le français reste le
   texte d'origine dans le code. Ce fichier ne contient que des données ; il s'enregistre auprès
   de i18n.js (I18N.addLang) et doit donc être chargé APRÈS lui.

   Règle d'extension : pour traduire un texte de plus, ajouter UNE ligne « français : hébreu »
   dans UI_HE (écran) ou DV_HE (contenu d'un devis). Un texte absent reste en français — jamais
   de texte cassé. Le test tests/hebreu.test.mjs vérifie que tout ce qui est traduit en anglais
   l'est aussi en hébreu.
   Les conditions générales ont été rédigées en hébreu courant : à faire relire par un juriste
   avant usage contractuel. */
(function(root){
'use strict';

const DV_LABELS_HE={
  devis:'הצעת מחיר',facture:'חשבונית',no:'מס׳',date:'תאריך',tel:'טל׳',
  destine:'מיועד ל',societe:'מס׳ חברה',projet:'פרויקט',adresse:'כתובת',
  surDevis:'לפי הצעת מחיר',optOui:'כן, אני מאשר/ת אופציה זו',optNon:'לא',
  hors:'לא כלול בשירות',
  partenaires:'ניתן להמליץ על שותפים מומחים בהתאם לצורכי הפרויקט.',
  htGlobal:'שכר טרחה — מחיר כולל (לפני מע״מ)',htTotal:'סה״כ לפני מע״מ',
  tvaNA:'מע״מ (לא רלוונטי)',tva:'מע״מ',ttc:'סה״כ כולל מע״מ',
  tvaNote:'מע״מ לא רלוונטי — יש לאשר עם רואה החשבון.',
  deroulement:'לוח זמנים',signature:'חתימה',signatureClient:'חתימת הלקוח',
  cgv:'תנאים כלליים',
  mailBonjour:'שלום',mailJoint:'מצורפת',leDevis:'הצעת המחיר',laFacture:'החשבונית',
  mailPourProjet:'עבור הפרויקט',mailPdf:'(יש לצרף את קובץ ה-PDF שהורד — דואר אלקטרוני אינו יכול לצרף קובץ אוטומטית)',
  waPdf:'(יש לצרף את קובץ ה-PDF שהורד — וואטסאפ ווב אינו יכול לצרף אותו אוטומטית)',
  cordialement:'בברכה',
  locale:'he-IL'
};

/* Contenu standard d'un devis (mêmes clés françaises que DV_EN dans i18n.js). */
const DV_HE={
  'Conseil':'ייעוץ','Conception':'תכנון','3D':'תלת־ממד','Technique':'טכני','Administratif':'אדמיניסטרטיבי',
  'Chiffrage':'תמחור','Chantier':'עבודות באתר','Compléments':'שירותים נוספים',
  '1er rdv explication du projet':'פגישה ראשונה: הצגת הפרויקט',
  'Visite sur site':'ביקור באתר',
  'Analyse des besoins':'ניתוח צרכים',
  "Étude et organisation des espaces : bar, assises, zone d'accueil, circulation.":'בחינה וארגון החללים: בר, מקומות ישיבה, אזור קבלה, תנועה.',
  'Étude de faisabilité':'בדיקת היתכנות',
  "Conception du concept décoratif et de l'ambiance générale.":'תכנון הקונספט העיצובי והאווירה הכללית.',
  "Relevé de l'existant":'מדידת המצב הקיים',
  'Esquisse / croquis':'סקיצה / שרטוטים',
  'Plans 2D':'תוכניות דו־ממד',
  'Coupes / façades':'חתכים / חזיתות',
  'Projet détaillé':'תכנון מפורט',
  "Plan d'aménagement intérieur":'תוכנית פנים',
  'Modélisation 3D':'מידול תלת־ממד','Vues 3D':'מבטי תלת־ממד','Rendus photoréalistes':'הדמיות פוטוריאליסטיות',
  'Création de 3 à 4 rendus 3D photoréalistes pour visualiser le projet.':'הכנת 3 עד 4 הדמיות תלת־ממד פוטוריאליסטיות להמחשת הפרויקט.',
  "Plans techniques d'exécution":'תוכניות ביצוע טכניות',
  "Réalisation des plans techniques destinés à l'entrepreneur : côtes, agencement, électricité, éclairage, plans détaillés, plomberie.":'הכנת התוכניות הטכניות עבור הקבלן: מידות, פריסה, חשמל, תאורה, תוכניות מפורטות, אינסטלציה.',
  'Plans électriques':'תוכניות חשמל','Plans plomberie':'תוכניות אינסטלציה',
  'Détails de menuiserie / mobilier':'פרטי נגרות / ריהוט',
  'Dossier permis construction / entreprise':'תיק היתר בנייה / רישוי עסק',
  'Déclaration préalable':'הצהרה מקדמית','Dépôt du dossier':'הגשת התיק','Autorisation de travaux':'אישור לביצוע עבודות',
  'Devis quantitatif et estimatif':'כתב כמויות ואומדן עלויות',
  'Demandes de 2 devis min. par corps de métier':'בקשת שתי הצעות מחיר לפחות מכל בעל מקצוע',
  'Analyse des devis':'ניתוח הצעות המחיר',
  'Coordination de projet (par semaine)':'ניהול ותיאום הפרויקט (לשבוע)',
  'Réunions de chantier':'ישיבות באתר',
  'Visites de chantier (par semaine)':'ביקורים באתר (לשבוע)',
  'Compte rendu de chantier (par semaine)':'דו״ח ביקור באתר (לשבוע)',
  'Suivi des travaux':'פיקוח על העבודות',
  "Le suivi de chantier consiste à vérifier la bonne mise en œuvre du projet et à accompagner le client pendant la phase de travaux. Des ajustements mineurs peuvent être pris en compte en cours de réalisation, tant qu'ils ne modifient pas la conception initiale. Ce suivi ne comprend pas la gestion complète des prestataires ni la coordination quotidienne, qui restent sous la responsabilité du client.":'הפיקוח כולל בדיקה שהפרויקט מבוצע כראוי וליווי הלקוח בשלב העבודות. ניתן להכניס שינויים קלים תוך כדי ביצוע, כל עוד אינם משנים את התכנון המקורי. הפיקוח אינו כולל ניהול מלא של בעלי המקצוע ואינו כולל תיאום יומיומי, שנשארים באחריות הלקוח.',
  'Estimation budgétaire':'אומדן תקציבי',
  'Une estimation budgétaire détaillée des travaux, menuiseries, matériaux et mobilier est fournie pour planifier le projet avec précision.':'מסופק אומדן תקציבי מפורט של העבודות, הנגרות, החומרים והריהוט, כדי לתכנן את הפרויקט במדויק.',
  'Sélection matériaux (2 jours)':'בחירת חומרים (יומיים)',
  'Sélection des matériaux, couleurs et revêtements.':'בחירת חומרים, צבעים וחיפויים.',
  'Sélection mobilier & luminaires':'בחירת ריהוט ותאורה',
  "Accompagnement dans les choix, jusqu'à deux visites incluses.":'ליווי בקבלת ההחלטות, עד שני ביקורים כלולים.',
  'Décoration':'עיצוב וקישוט',
  'Commandes chez prestataires':'הזמנות אצל ספקים',
  'Détails des prestataires : ':'פרטי הספקים: ',
  'Réception / vérification de la marchandise':'קבלה / בדיקת הסחורה',
  'Détails de la marchandise : ':'פרטי הסחורה: ',
  'Gestion du projet de A à Z':'ניהול הפרויקט מא׳ ועד ת׳',
  'Travail express':'עבודה דחופה',
  'Honoraires des prestataires et corps de métier (facturés séparément)':'שכר בעלי המקצוע והספקים (מחויב בנפרד)',
  "Consultants externes / bureaux d'études / ingénieurs":'יועצים חיצוניים / משרדי הנדסה / מהנדסים',
  'Coordination quotidienne des prestataires (reste sous la responsabilité du client)':'תיאום יומיומי של בעלי המקצוע (נשאר באחריות הלקוח)',
  /* Conditions générales d'origine */
  '1. Objet du contrat.':'1. מהות החוזה.',
  "Les présentes conditions générales de vente régissent les relations contractuelles entre l'architecte et le client, définissant les droits et obligations de chaque partie.":'התנאים הכלליים הללו מסדירים את היחסים החוזיים בין האדריכלית ללקוח, וקובעים את זכויותיו וחובותיו של כל צד.',
  "2. Prestations de l'architecte.":'2. שירותי האדריכלית.',
  "L'architecte s'engage à fournir des services de conception, de planification et de supervision des travaux conformément aux normes professionnelles en vigueur.":'האדריכלית מתחייבת לספק שירותי תכנון, תיאום ופיקוח על העבודות בהתאם לתקנים המקצועיים הנהוגים.',
  '3. Honoraires et modalités de paiement.':'3. שכר טרחה ותנאי תשלום.',
  "Les honoraires sont fixés selon une prestation globale. Les paiements s'effectuent selon les modalités suivantes :\n- 30 % à la signature du contrat\n- 40 % à la remise des plans définitifs (après validation de la liste des quantités des matériaux)\n- 30 % à la fin des travaux si la prestation de suivi de chantier est prise":'שכר הטרחה נקבע כמחיר כולל. התשלומים יבוצעו כדלקמן:\n- 30% עם החתימה על החוזה\n- 40% עם מסירת התוכניות הסופיות (לאחר אישור רשימת כמויות החומרים)\n- 30% בסיום העבודות, אם נבחר שירות פיקוח על העבודות',
  '4. Obligations des parties.':'4. התחייבויות הצדדים.',
  "Le client fournit toutes les informations nécessaires et respecte les délais de paiement. L'architecte respecte les délais de réalisation. Les plans sont validés en commun avant transmission au maître d'œuvre et aux prestataires.":'הלקוח מספק את כל המידע הנדרש ועומד במועדי התשלום. האדריכלית עומדת בלוחות הזמנים של העבודה. התוכניות מאושרות במשותף לפני העברתן למנהל העבודה ולבעלי המקצוע.',
  '5. Modifications et révisions.':'5. שינויים ותיקונים.',
  "Toute modification du projet initial validé pourra faire l'objet d'un avenant précisant les nouvelles conditions financières et les délais supplémentaires éventuels.":'כל שינוי בפרויקט המקורי שאושר עשוי להיות מוסדר בנספח המפרט את התנאים הכספיים החדשים ואת הזמן הנוסף הנדרש, אם יידרש.',
  '6. Responsabilité et assurance.':'6. אחריות וביטוח.',
  "L'architecte met en œuvre tous les moyens nécessaires à la bonne exécution des prestations. Les prestataires doivent disposer d'une assurance responsabilité civile professionnelle.":'האדריכלית תפעל בכל האמצעים הנדרשים לביצוע תקין של השירותים. על בעלי המקצוע להחזיק בביטוח אחריות מקצועית.',
  '7. Résiliation.':'7. סיום ההתקשרות.',
  "En cas de résiliation par l'une des parties, un préavis de 30 jours est requis. Les honoraires dus pour les prestations réalisées restent exigibles.":'במקרה של סיום ההתקשרות על ידי אחד הצדדים, נדרשת הודעה מראש של 30 ימים. שכר הטרחה בגין השירותים שכבר בוצעו נשאר לתשלום.',
  '8. Clause de non-responsabilité.':'8. הגבלת אחריות.',
  "L'architecte ne pourra être tenu responsable d'un arrêt des travaux pour des raisons indépendantes de sa volonté (météo, décisions administratives, situation de guerre, financement du client ou défaillance d'un entrepreneur).":'האדריכלית לא תישא באחריות להפסקת העבודות מסיבות שאינן בשליטתה (מזג אוויר, החלטות מנהליות, מצב ביטחוני, מימון הלקוח או כשל של קבלן).',
  '9. Frais administratifs et prestataires externes.':'9. עלויות אדמיניסטרטיביות וספקים חיצוניים.',
  "Les frais administratifs et les coûts des prestataires externes (ingénieurs, consultants, etc.) ne sont pas inclus dans les honoraires et sont facturés séparément.":'העלויות האדמיניסטרטיביות ועלויות הספקים החיצוניים (מהנדסים, יועצים וכד׳) אינן כלולות בשכר הטרחה ומחויבות בנפרד.',
  '10. Litiges et juridiction.':'10. מחלוקות וסמכות שיפוט.',
  "En cas de litige, les parties recherchent une solution amiable. À défaut, le tribunal compétent sera celui du lieu de résidence de l'architecte.":'במקרה של מחלוקת, הצדדים ינסו להגיע לפתרון בהסכמה. אם לא יצלחו, בית המשפט המוסמך יהיה זה שבאזור מגוריה של האדריכלית.'
};

/* Interface : français -> hébreu (mêmes clés françaises que UI_EN dans i18n.js). */
const UI_HE={
  /* connexion */
  'Connexion à votre espace':'התחברות לאזור האישי','Se connecter':'התחברות','E-mail':'דוא״ל','Mot de passe':'סיסמה',
  /* barre du haut, navigation */
  'Tableau de bord':'לוח בקרה','Tableau':'לוח בקרה','Devis':'הצעות מחיר','Clients':'לקוחות','Réalisations':'פרויקטים','Boutique':'חנות',
  '📝 Composer':'📝 עריכה','📂 Mes devis':'📂 ההצעות שלי','📐 Estimation du Projet':'📐 אומדן פרויקט',
  '📝 Composer un devis':'📝 עריכת הצעת מחיר',
  '📱 Mobile':'📱 נייד','🖥 Bureau':'🖥 מחשב','⚙ Réglages':'⚙ הגדרות','Sauvegarde':'גיבוי','💾 Sauvegarde':'💾 גיבוי','🔄 Synchronisation':'🔄 סנכרון',
  'Synchronisation':'סנכרון','Plus':'עוד','Rechercher':'חיפוש','Rechercher (Ctrl+K)':'חיפוש (Ctrl+K)','Plus d’actions':'פעולות נוספות',
  '👁 Aperçu':'👁 תצוגה מקדימה','Diagnostic synchro':'אבחון סנכרון','Navigation principale':'ניווט ראשי','Vue':'תצוגה',
  /* éditeur de devis */
  'Gérer le devis':'ניהול ההצעה','Produire & envoyer':'הפקה ושליחה',
  '🆕 Nouveau Devis':'🆕 הצעת מחיר חדשה','📝 Enregistrer brouillon':'📝 שמירת טיוטה','💾 Enregistrer Devis':'💾 שמירת הצעה','📋 Édition des services':'📋 עריכת השירותים',
  '🧾 Convertir en facture':'🧾 המרה לחשבונית','↺ Repasser en devis':'↺ חזרה להצעת מחיר','🖨 Imprimer PDF':'🖨 הדפסת PDF',
  '📧 Envoyer par email':'📧 שליחה בדוא״ל','Envoyer par WhatsApp':'שליחה בוואטסאפ',
  'N° de devis':'מס׳ הצעה','Date':'תאריך','Langue du devis':'שפת ההצעה',
  'Client':'לקוח','Raison sociale / nom':'שם החברה / הלקוח','Contact':'איש קשר','Téléphone':'טלפון','Email':'דוא״ל','Adresse':'כתובת',
  'N° société':'מס׳ חברה','Ville':'עיר','Code postal':'מיקוד',
  'Projet':'פרויקט','Intitulé du projet':'שם הפרויקט','Surface (m²)':'שטח (מ״ר)','Adresse du projet':'כתובת הפרויקט',"Texte d'introduction":'טקסט פתיחה',
  'Tarification':'תמחור','Forfait global':'מחיר כולל','Détail par prestation':'פירוט לפי שירות','Montant global':'סכום כולל','Ce montant est':'הסכום הוא',
  'H.T.':'לפני מע״מ','T.T.C.':'כולל מע״מ',
  'Prestations · cochez ce qui est inclus':'שירותים · סמנו מה כלול','Hors prestation · non compris':'לא כלול בשירות',
  'Déroulement (optionnel)':'לוח זמנים (אופציונלי)','Afficher un calendrier indicatif':'להציג לוח זמנים מנחה','Étapes (une par ligne)':'שלבים (אחד בכל שורה)',
  'TVA & options':'מע״מ ואפשרויות','Taux de TVA (%)':'שיעור מע״מ (%)','Devise':'מטבע','₪ (Shekel)':'₪ (שקל)','€ (Euro)':'€ (אירו)','$ (Dollar)':'$ (דולר)',
  'Facturation hors Israël — TVA non applicable':'חיוב מחוץ לישראל — מע״מ לא רלוונטי',
  'Inclure les conditions générales':'לכלול את התנאים הכלליים','✎ Modifier':'✎ עריכה',
  'Signature client':'חתימת הלקוח','Signataire différent de la raison sociale (personne physique)':'החותם שונה משם החברה (אדם פרטי)',
  'Nom du signataire':'שם החותם','✎ Faire signer le client':'✎ חתימת הלקוח','Effacer la signature':'מחיקת החתימה',
  '+ Ajouter une ligne':'+ הוספת שורה','+ Ajouter un élément':'+ הוספת פריט','Intitulé':'כותרת','Élément non compris':'פריט שאינו כלול','Supprimer':'מחיקה',
  'Inclus (sans prix)':'כלול (ללא מחיר)','Prix fixe':'מחיר קבוע','Quantité × P.U.':'כמות × מחיר ליחידה','Prix / m²':'מחיר למ״ר','Sur devis':'לפי הצעת מחיר',
  'Qté':'כמות',
  /* actions communes */
  'Annuler':'ביטול','Confirmer':'אישור','Enregistrer':'שמירה','Fermer':'סגירה','Modifier':'עריכה','Ouvrir':'פתיחה','Retirer':'הסרה','Valider':'אישור',
  'Oui':'כן','Non':'לא','Chargement…':'טוען…','Aucun client trouvé.':'לא נמצא לקוח.','Rechercher un client…':'חיפוש לקוח…',
  'Enregistrer le devis':'שמירת ההצעה','Nom du devis':'שם ההצעה','…ou attribuer à un client existant':'…או שיוך ללקוח קיים',
  '→ Sans client pour l\'instant.':'← בלי לקוח בינתיים.',
  'Attribuer à un client':'שיוך ללקוח','Mes devis':'ההצעות שלי','Mes estimations':'האומדנים שלי',
  'Brouillon':'טיוטה','Validé':'אושר','Facture':'חשבונית','En attente':'ממתין','Accepté':'התקבל','Refusé':'נדחה',
  /* réglages */
  'Réglages':'הגדרות','Tout ce qui apparaît sur tes devis — modifiable ici, sans toucher au code.':'כל מה שמופיע בהצעות המחיר שלך — ניתן לעריכה כאן, בלי לגעת בקוד.',
  'Langues':'שפות','Langue de l’interface':'שפת הממשק','Langue par défaut des nouveaux devis':'שפת ברירת המחדל של הצעות חדשות',
  'Français':'צרפתית','English':'אנגלית',
  'Ce que tu lis à l’écran. Réglé sur cet appareil.':'מה שמוצג לך במסך. מוגדר במכשיר הזה.',
  'Chaque devis peut ensuite changer de langue dans l’éditeur. Indépendante de l’interface.':'אפשר להחליף שפה בכל הצעה בנפרד בעורך. בלתי תלויה בשפת הממשק.',
  'Identité':'זהות',"Nom de l'entreprise":'שם העסק','Coordonnées':'פרטי קשר','Réseau social':'רשת חברתית',
  'Intitulé de la licence':'כותרת הרישיון','Numéro de société / licence':'מספר חברה / רישיון','Mentions régionales':'ציונים אזוריים',
  'Devis — valeurs par défaut':'הצעות מחיר — ערכי ברירת מחדל','Devise par défaut':'מטבע ברירת מחדל','TVA par défaut (%)':'מע״מ ברירת מחדל (%)',
  '1er n° de devis':'מס׳ הצעה ראשון','Préfixe des n° de devis':'קידומת למספרי ההצעות','Couleurs du devis':'צבעי ההצעה',
  'Depuis une photo…':'מתוך תמונה…',"S'applique uniquement au devis imprimé.":'חל על ההצעה המודפסת בלבד.',
  'Typographie du devis':'גופנים של ההצעה','Raccourcis':'קיצורים','Couleurs de l\'application':'צבעי האפליקציה',
  'Bibliothèque & Hors prestation':'ספרייה ופריטים שאינם כלולים','Conditions générales':'תנאים כלליים','Catégories de chantier':'קטגוריות פרויקט',
  'Photos & retouche IA':'תמונות ועריכה בבינה מלאכותית','Rédaction IA — consommation':'כתיבה בבינה מלאכותית — צריכה','↺ Tout réinitialiser':'↺ איפוס הכול',
  'Réglages enregistrés':'ההגדרות נשמרו',
  /* tableau de bord */
  'Mes tâches':'המשימות שלי','+ Nouvelle tâche':'+ משימה חדשה','🔍 Filtrer':'🔍 סינון','↑ Ordre':'↑ סדר','⚙ Catégories':'⚙ קטגוריות','Assistant · à faire':'עוזר · לביצוע',
  'Nouvelle tâche':'משימה חדשה','Catégories de tâches':'קטגוריות משימות',
  /* estimation */
  'Estimation du Projet':'אומדן פרויקט','Catégories':'קטגוריות','Nouvelle estimation':'אומדן חדש','Résumé par catégorie':'סיכום לפי קטגוריה',
  'Total général':'סה״כ כללי','+ Ajouter une catégorie':'+ הוספת קטגוריה',
  /* réalisations / boutique */
  '📷 Bien photographier':'📷 טיפים לצילום','⚙ Le site public':'⚙ האתר הציבורי','🌐 Voir le site':'🌐 צפייה באתר','+ Nouvelle réalisation':'+ פרויקט חדש',
  '+ Nouveau produit':'+ מוצר חדש','Le site public':'האתר הציבורי',
  /* clients */
  'Clients & comptes':'לקוחות וחשבונות','⬇ Export CSV':'⬇ ייצוא CSV','⬆ Import CSV':'⬆ ייבוא CSV','⚙ Statuts':'⚙ סטטוסים','+ Nouveau client':'+ לקוח חדש',
  'Cliquez sur un en-tête de colonne pour trier ↑↓':'לחצו על כותרת עמודה כדי למיין ↑↓','Statuts clients':'סטטוסים של לקוחות',
  'En cours':'בתהליך','Devis envoyé':'הצעה נשלחה','Terminé':'הושלם','Annulé':'בוטל',
  /* sauvegarde / divers */
  'Sauvegarde des données':'גיבוי הנתונים','Bibliothèque':'ספרייה','Réglages — Photos & retouche IA':'הגדרות — תמונות ועריכה בבינה מלאכותית',
  'Rédaction IA — ce qu’elle a coûté':'כתיבה בבינה מלאכותית — מה היא עלתה',
  /* Réglages › Application */
  'Application':'אפליקציה',
  'Installe le CRM sur cet appareil : il s’ouvre dans sa propre fenêtre, avec son icône, comme une application. Comme dans le navigateur, il faut internet pour s’en servir.':'התקנת ה-CRM במכשיר הזה: הוא נפתח בחלון משלו, עם אייקון משלו, כמו אפליקציה. כמו בדפדפן, נדרש חיבור לאינטרנט כדי להשתמש בו.',
  'Installer l’application':'התקנת האפליקציה','Installation…':'מתקין…',
  'Application installée ✓':'האפליקציה הותקנה ✓',
  'Tu utilises déjà le CRM en mode application.':'אתה כבר משתמש ב-CRM כאפליקציה.',
  'Ouvre-la depuis son icône « CRM Melissa », sur ton écran d’accueil ou dans tes applications.':'פתח אותה מהאייקון „CRM Melissa” במסך הבית או בין האפליקציות שלך.',
  'Sur iPhone et iPad, l’installation se fait depuis Safari :':'באייפון ובאייפד ההתקנה נעשית מתוך Safari:',
  'Touche l’icône Partager (le carré avec une flèche vers le haut).':'לחץ על סמל השיתוף (ריבוע עם חץ כלפי מעלה).',
  'Choisis « Sur l’écran d’accueil », puis « Ajouter ».':'בחר „הוסף למסך הבית”, ואז „הוסף”.',
  'Ton navigateur peut installer l’application depuis son menu :':'הדפדפן שלך יכול להתקין את האפליקציה מהתפריט:',
  'Ouvre le menu du navigateur (les trois points).':'פתח את תפריט הדפדפן (שלוש הנקודות).',
  'Choisis « Installer l’application » (ou « Ajouter à l’écran d’accueil »).':'בחר „התקן אפליקציה” (או „הוסף למסך הבית”).',
  'Sur ordinateur, tu peux aussi cliquer sur l’icône d’installation, à droite de la barre d’adresse. Si l’application est déjà installée ici, ouvre-la depuis son icône.':'במחשב אפשר גם ללחוץ על סמל ההתקנה בצד שמאל של שורת הכתובת. אם האפליקציה כבר מותקנת כאן, פתח אותה מהאייקון שלה.',
  'Ce navigateur ne sait pas installer l’application. Ouvre le CRM dans Chrome (Android ou ordinateur) ou dans Safari (iPhone et iPad), puis reviens ici.':'הדפדפן הזה אינו יודע להתקין את האפליקציה. פתח את ה-CRM ב-Chrome (אנדרואיד או מחשב) או ב-Safari (אייפון ואייפד), ואז חזור לכאן.',
  'Installation annulée.':'ההתקנה בוטלה.','Installation annulée':'ההתקנה בוטלה','Installation impossible':'ההתקנה נכשלה',
  /* messages */
  'Converti en facture':'הומר לחשבונית','Repassé en devis':'הוחזר להצעת מחיר','Texte généré':'הטקסט נוצר','Réponse vide':'תשובה ריקה',
  'Mobile':'נייד','Bureau':'מחשב'
};

const UI_PATTERNS_HE=[
  [/^Aperçu ouvert — bouton « Imprimer \/ Enregistrer en PDF »$/,()=>'התצוגה המקדימה נפתחה — לחצו על „הדפסה / שמירה כ-PDF”'],
  [/^Réglages remis à zéro$/,()=>'ההגדרות אופסו'],
  [/^(\d+) devis$/,(m)=>m[1]+' הצעות מחיר'],
  [/^Installation impossible \((.*)\)\. Essaie par le menu du navigateur\.$/,(m)=>'ההתקנה נכשלה ('+m[1]+'). נסה דרך תפריט הדפדפן.']
];

/* Texte de l'onglet du navigateur : « Générateur de devis — X ». */
const TITRE_HE=(x)=>'מחולל הצעות מחיר — '+x;

if(root.I18N&&root.I18N.addLang){
  root.I18N.addLang('he',{dir:'rtl',labels:DV_LABELS_HE,dv:DV_HE,ui:UI_HE,patterns:UI_PATTERNS_HE,titre:TITRE_HE});
}
const api={DV_LABELS_HE,DV_HE,UI_HE,UI_PATTERNS_HE};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
