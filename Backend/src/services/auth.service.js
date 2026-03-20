function loginWithPhone(phone) {
  const cleaned = String(phone || "").replace(/\s+/g, "");
  if (cleaned.length < 8) {
    const error = new Error("Numero de telephone invalide.");
    error.status = 400;
    throw error;
  }

  return {
    token: `demo-${cleaned}`,
    user: {
      id: "u_demo_1",
      phone: cleaned,
    },
  };
}

module.exports = {
  loginWithPhone,
};
