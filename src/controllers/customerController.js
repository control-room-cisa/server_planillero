import { connectDBPlanillero } from "../config/connectDB.js";

const getCustomerAll = async (req, res) => {
  try {

    const [rows] = await connectDBPlanillero.query(
      "SELECT `id`, `nombre`, `created_at`, `updated_at` FROM `empresas`"
    );

    res.status(200).json(rows);
  } catch (error) {
    console.error("Error al obtener las empresas:", error);
    res.status(500).json({ error: "Error al obtener las empresas" });
  }
};

const getCustomerJob = async (req, res) => {
  try {
    const select = `
      SELECT 
        id, 
        company_name, 
        job_number, 
        job_description 
      FROM company_jobs 
      ORDER BY company_name ASC, job_number ASC
    `;

    const [rows] = await connectDBPlanillero.query(select);

    res.status(200).json(rows);
  } catch (error) {
    console.error('Error fetching customer jobs:', error.message);
    res.status(500).json({ message: 'Error retrieving jobs', error: error.message });
  }
};


export {
  getCustomerAll,
  getCustomerJob
};
