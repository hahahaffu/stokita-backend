const verifyEmailTemplate = (name, link) => {
  return `
    <div style="font-family:Arial;padding:30px">
      <h2>Halo ${name} 👋</h2>

      <p>Terima kasih telah mendaftar di <b>Stokita</b>.</p>

      <p>Silakan klik tombol berikut untuk memverifikasi email Anda.</p>

      <a href="${link}"
        style="
          display:inline-block;
          padding:14px 25px;
          background:#8bc34a;
          color:white;
          text-decoration:none;
          border-radius:8px;
          font-weight:bold;
        ">
        Verifikasi Email
      </a>

      <p style="margin-top:20px">
        Link berlaku selama 24 jam.
      </p>
    </div>
  `;
};

module.exports = {
  verifyEmailTemplate,
};