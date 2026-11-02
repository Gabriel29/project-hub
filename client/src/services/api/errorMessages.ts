import { t, type TranslationKey } from "../../i18n";

// Legacy message fallback for mixed-version rollouts. Prefer stable Problem Details codes.
const apiErrorKeys: Record<string, TranslationKey> = {
  "Email sau parolă incorectă.": "errors.invalidCredentials",
  "Limba trebuie să fie en sau ro.": "errors.invalidLanguage",
  "Acces interzis.": "errors.accessDenied",
  "Activați contul.": "errors.activateAccount",
  "Activitate inexistentă.": "errors.activityNotFound",
  "Actualizare invalidă.": "errors.invalidUpdate",
  "Autentificare necesară.": "errors.signInRequired",
  "Calendar invalid.": "errors.invalidCalendar",
  "Cheia de configurare este incorectă.": "errors.invalidSetupKey",
  "Client indisponibil.": "errors.clientUnavailable",
  "Client inexistent.": "errors.clientNotFound",
  "Client invalid.": "errors.invalidClient",
  "Configurarea a fost finalizată.": "errors.setupCompleted",
  "Cont deja activat.": "errors.accountActivated",
  "Cont inexistent.": "errors.accountNotFound",
  "Coperta trebuie să fie o fotografie.": "errors.coverMustBePhoto",
  "Căutarea este prea lungă.": "errors.searchTooLong",
  "Date proiect invalide.": "errors.invalidProject",
  "Denumire client invalidă.": "errors.invalidClientName",
  "Denumire folder invalidă.": "errors.invalidFolderName",
  "Destinație fotografie invalidă.": "errors.invalidPhotoDestination",
  "Detașați fotografia din activitate înainte de mutare.": "errors.detachPhotoBeforeMove",
  "Detașați fotografiile din activități înainte de mutare.": "errors.detachPhotosBeforeMove",
  "Detașați fotografiile din activități înainte de ștergere.": "errors.detachPhotosBeforeDelete",
  "Doar proprietarul poate schimba fotografia proiectului.": "errors.ownerOnlyPhoto",
  "Document inexistent.": "errors.documentNotFound",
  "Email invalid.": "errors.invalidEmail",
  "Email sau parolă incorectă sau cont blocat temporar.": "errors.credentialsOrLocked",
  "Emailul nu poate fi modificat.": "errors.emailCannotChange",
  "Etapa curentă nu poate fi eliminată. Schimbați întâi etapa curentă.":
    "errors.currentStageRemoval",
  "Etape invalide.": "errors.invalidStages",
  "Etapele cu activități nu pot fi eliminate. Mutați întâi activitățile.":
    "errors.stagesHaveActivities",
  "Etapă invalidă.": "errors.invalidStage",
  "Există deja un folder cu această denumire.": "errors.folderNameExists",
  "Fișier inexistent.": "errors.fileNotFound",
  "Denumire fișier invalidă.": "errors.invalidFileName",
  "Fișier invalid sau mai mare de 25 MB.": "errors.invalidFileSize",
  "Folder invalid pentru acest proiect.": "errors.folderOutsideProject",
  "Folder invalid.": "errors.invalidFolder",
  "Folderul de progres acceptă doar fotografii.": "errors.progressPhotosOnly",
  "Folderul nu aparține secțiunii selectate.": "errors.folderOutsideSection",
  "Format de fișier invalid.": "errors.invalidFileFormat",
  "Fotografii invalide.": "errors.invalidPhotos",
  "Link expirat sau utilizat.": "errors.linkExpiredOrUsed",
  "Link expirat sau utilizat. Solicitați un link nou.": "errors.requestNewLink",
  "Maximum 20 de fotografii per activitate.": "errors.activityPhotoLimit",
  "Notiță inexistentă.": "errors.noteNotFound",
  "Notiță invalidă.": "errors.invalidNote",
  "Nu aveți drept de încărcare în acest folder.": "errors.uploadForbidden",
  "Nume fișier prea lung.": "errors.fileNameTooLong",
  "Nume invalid.": "errors.invalidName",
  "Număr de telefon invalid.": "errors.invalidPhone",
  "Parola curentă este incorectă.": "errors.incorrectPassword",
  "Parola necesită minimum 6 caractere, o literă și o cifră.": "errors.passwordRequirements",
  "Proiect inexistent.": "errors.projectNotFound",
  "Reviziile nu mai sunt acceptate. Încărcați un fișier nou.": "errors.revisionsUnsupported",
  "Schimbați fotografia de copertă înainte de ștergere.": "errors.changeCoverBeforeDelete",
  "Secțiune invalidă.": "errors.invalidSection",
  "Selectați un client existent sau Fara Client.": "errors.selectExistingClient",
  "Selectați un manager activ din echipă.": "errors.selectActiveManager",
  "Stadiu invalid.": "errors.invalidStatus",
  "Tip de link invalid pentru acest cont.": "errors.invalidLinkType",
  "Toate prefixele sunt ocupate.": "errors.prefixesExhausted",
  "Un folder nu poate fi mutat în el însuși sau în subfolderele sale.": "errors.folderMoveCycle",
  "Valoarea există deja.": "errors.valueExists",
  Owner: "roles.owner",
  Admin: "roles.admin",
  "A apărut o eroare. Încercați din nou.": "errors.unexpected",
  "Portalul este în mentenanță. Revenim în curând.": "errors.maintenance",
  "Emailul este deja folosit.": "errors.emailInUse",
};

export function localizeApiMessage(message: string): string {
  const key = Object.hasOwn(apiErrorKeys, message) ? apiErrorKeys[message] : undefined;

  return key ? t(key) : message;
}

export function localizeApiCode(code?: string): string | undefined {
  if (!code) {
    return undefined;
  }

  const genericKeys: Record<string, TranslationKey> = {
    invalidRequest: "errors.invalidRequest",
    rateLimited: "errors.rateLimited",
    notFound: "errors.notFound",
    concurrentChange: "errors.concurrentChange",
  };
  const key =
    (Object.hasOwn(genericKeys, code) ? genericKeys[code] : undefined) ??
    Object.values(apiErrorKeys).find((value) => value === `errors.${code}`);

  return key ? t(key) : undefined;
}
