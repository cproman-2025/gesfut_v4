# GesFUT - PostgreSQL Migration

This is a NextJS application migrated from Firebase to PostgreSQL with PostgREST.

## Setup Instructions

1. **Start the database services:**
   ```bash
   docker-compose up -d
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   Copy `.env.local` and update the values as needed.

4. **Start the development server:**
   ```bash
   npm run dev
   ```

## Services

- **PostgreSQL**: Database running on port 5432
- **PostgREST**: API server running on port 3000
- **pgAdmin**: Database admin interface on port 5050
- **Next.js**: Frontend application on port 3001

## Database Access

- **pgAdmin**: http://localhost:5050
  - Email: admin@gesfut.com
  - Password: admin

## Migration Notes

- Firebase Firestore has been replaced with PostgreSQL
- Firebase Auth has been replaced with a simple local auth system
- All Firestore queries have been converted to PostgREST API calls
- Real-time features are disabled (can be re-enabled with PostgreSQL LISTEN/NOTIFY)