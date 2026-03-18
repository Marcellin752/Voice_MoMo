const userState = {
  id: "u_demo_1",
  fullName: "Edwin",
  email: "edwin@example.com",
  phone: "0123456789",
  language: "fr",
  pinUpdatedAt: null,
  notifications: [
    { id: "n1", title: "Depot recu", content: "Vous avez recu +25 000 FCFA.", when: "Aujourd'hui 15:32" },
    { id: "n2", title: "Paiement confirme", content: "Votre paiement marchand a ete valide.", when: "Hier 11:45" },
  ],
};

function getProfile() {
  return {
    id: userState.id,
    fullName: userState.fullName,
    email: userState.email,
    phone: userState.phone,
  };
}

function updateProfile(data) {
  if (typeof data.fullName === "string") userState.fullName = data.fullName.trim();
  if (typeof data.email === "string") userState.email = data.email.trim();
  if (typeof data.phone === "string") userState.phone = data.phone.trim();
  return getProfile();
}

function getLanguage() {
  return { language: userState.language };
}

function updateLanguage(language) {
  userState.language = language;
  return getLanguage();
}

function updatePin() {
  userState.pinUpdatedAt = new Date().toISOString();
  return { pinUpdatedAt: userState.pinUpdatedAt };
}

function getSecurityState() {
  return { pinUpdatedAt: userState.pinUpdatedAt };
}

function getNotifications() {
  return userState.notifications;
}

module.exports = {
  getProfile,
  updateProfile,
  getLanguage,
  updateLanguage,
  updatePin,
  getSecurityState,
  getNotifications,
};
