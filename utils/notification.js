const db = require("../db");

const createNotification = async ({
  user_id,
  type,
  title,
  message,
  order_id,
  total,
}) => {

  await db.query(
    `
    INSERT INTO notifications
    (
      user_id,
      type,
      title,
      message,
      order_id,
      total
    )
    VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      user_id,
      type,
      title,
      message,
      order_id ?? null,
      total ?? null,
    ]
  );

};

module.exports = {
  createNotification
};