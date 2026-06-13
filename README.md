# NayePankh Foundation - Volunteer & Admin Management Portal

A full-stack Node.js web application built for the NayePankh Foundation internship evaluation. This portal streamlines the onboarding experience for new volunteers while equipping administrators with live metric dashboards to approve or reject applications safely.

## 🚀 Live Demo Link
👉 **[Click Here to Access the Live Portal](http://13.51.178.250:3000/login)**

---

### 👤 Volunteer Dashboard (Dynamic States)
* **Approved Status Layout:** Displays custom welcome toolkits, community links, and handbook downloads once approved.
* **Unique Registration Guard:** Real-time email validation prevents account duplication.

### 📊 Admin Management Control Panel
* Live metric cards track **Total Applicants**, **Approved Personnel**, and **Pending Decisions**.
* One-click action buttons update volunteer statuses directly in MongoDB Atlas.

* use for admin dashboard
*  Email: admin@demo.com
*  Password: Admin@1234

---

## ✨ Features Implemented

* **Secure Authentication Engine:** Password hashing using `bcryptjs` and active state session tracking using `express-session`.
* **Unique Email Enforcement:** Multi-tier duplication checks blocking duplicate user registration.
* **Dynamic Volunteer Dashboard:** Features real-time conditional rendering using EJS templates based on application status (`Pending`, `Approved`, `Rejected`).
* **Comprehensive Administrative Panel:** Provides global dashboard visibility with automated KPI calculation cards (`Total Applicants`, `Approved Personnel`, `Pending Review Decisions`) and immediate status update triggers.
* **Secure Cloud Database:** Robust interaction pipelines wired into a MongoDB Atlas cluster.

---

## 🛠️ Tech Stack Used

* **Frontend:** Embedded JavaScript Templates (EJS), Tailwind CSS (via CDN)
* **Backend:** Node.js, Express.js
* **Database:** MongoDB Atlas (Mongoose ODM)
* **Security:** BcryptJS, Express-Session, Privilege Escalation Guardrails

---

## ☁️ AWS Production Deployment

This application is fully deployed and production-ready on an **AWS EC2 (Ubuntu)** instance.

* **Hosting:** Hosted on an AWS EC2 instance.
* **Process Management:** Utilizes **PM2** to keep the Node.js application running 24/7, ensuring the portal remains live even if the system restarts.
* **Network Security:** Managed via AWS Security Groups, with configured inbound rules for HTTP (80), HTTPS (443), and custom TCP traffic on port 3000 to facilitate secure web access.
---

## 💻 Local Setup Instructions

If you prefer running the workspace application environment locally:

1. Clone the repository:
   ```bash
   git clone [https://github.com/SilverMoon-ops/NayePankh.git](https://github.com/SilverMoon-ops/NayePankh.git)
   cd NayePankh
