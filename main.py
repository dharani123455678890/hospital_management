import datetime
import json
import os

import firebase_admin
from firebase_admin import auth as firebase_auth
from firebase_admin import credentials, firestore
from fastapi import FastAPI, File, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import List
import cloudinary
import cloudinary.uploader

# Cloudinary configuration
cloudinary.config(
  cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME"),
  api_key = os.getenv("CLOUDINARY_API_KEY"),
  api_secret = os.getenv("CLOUDINARY_API_SECRET"),
  secure = True
)

# Initialize Firebase Admin SDK
try:
    service_account_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
    if service_account_json:
        cred = credentials.Certificate(json.loads(service_account_json))
    else:
        cred = credentials.Certificate("serviceAccountKey.json")
    firebase_admin.initialize_app(cred)
except ValueError:
    pass
except FileNotFoundError:
    print("Warning: Firebase credentials were not provided.")

# Get a reference to the Firestore database, but only if an app is initialized
try:
    firebase_admin.get_app()
    db = firestore.client(database_id="default")
except ValueError:
    db = None

app = FastAPI()

allowed_origins = [
    origin.strip()
    for origin in os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:5500,http://127.0.0.1:5500",
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

allowed_emails = {
    email.strip().lower()
    for email in os.getenv("ALLOWED_EMAILS", "").split(",")
    if email.strip()
}


@app.middleware("http")
async def require_firebase_auth(request: Request, call_next):
    if request.method == "OPTIONS" or request.url.path == "/":
        return await call_next(request)

    authorization = request.headers.get("Authorization", "")
    if not authorization.startswith("Bearer "):
        return JSONResponse({"error": "Authentication required"}, status_code=401)

    try:
        decoded_token = firebase_auth.verify_id_token(authorization[7:])
    except Exception as exc:
        print("Authentication error:", exc)
        return JSONResponse({"error": "Invalid authentication token"}, status_code=401)

    email = decoded_token.get("email", "").lower()
    if allowed_emails and email not in allowed_emails:
        return JSONResponse({"error": "This account is not authorized"}, status_code=403)

    request.state.user = decoded_token
    return await call_next(request)
from fastapi import Body


from fastapi import Body

@app.post("/update_visit")
def update_visit(data: dict = Body(...)):
    try:
        patient_id = data.get("patient_id")
        visit_id = data.get("visit_id")

        if not patient_id or not visit_id:
            return {"status": "error", "message": "Missing IDs"}

        # normalize patient id
        if not patient_id.startswith("p"):
            patient_id = f"p{patient_id}"

        visit_ref = db.collection("patients") \
            .document(patient_id) \
            .collection("visits") \
            .document(visit_id)

        # check if exists
        doc = visit_ref.get()
        if not doc.exists:
            return {"status": "error", "message": "Visit not found"}

        # update fields
        visit_ref.update({
            "visit_date": data.get("visit_date"),
            "problem": data.get("problem"),
            "medicine_given": data.get("medicine_given"),
            "prescription": data.get("prescription"),
            "amount_paid": data.get("amount_paid"),
            "images": data.get("images", []),
            "updated_at": datetime.datetime.now(datetime.timezone.utc)
        })

        return {"status": "success"}

    except Exception as e:
        print("UPDATE ERROR:", e)
        return {"status": "error"}

@app.post("/upload_images")
async def upload_images(files: List[UploadFile] = File(...)):
    if not files:
        return {"status": "error", "message": "No files provided"}
    
    urls = []
    try:
        for file in files:
            result = cloudinary.uploader.upload(file.file)
            urls.append(result.get("secure_url"))
        return {"status": "success", "urls": urls}
    except Exception as e:
        print("Upload Error:", e)
        return {"status": "error", "message": str(e)}

@app.post("/add_visit")
def add_visit(data: dict = Body(...)):
    try:
        patient_id = data.get("patient_id")

        if not patient_id.startswith("p"):
            patient_id = f"p{patient_id}"

        db.collection("patients") \
            .document(patient_id) \
            .collection("visits") \
            .add({
                "visit_date": data.get("visit_date"),
                "problem": data.get("problem"),
                "medicine_given": data.get("medicine_given"),
                "prescription": data.get("prescription"),
                "amount_paid": data.get("amount_paid"),
                "images": data.get("images", []),
                "created_at": datetime.datetime.now(datetime.timezone.utc)
            })

        return {"status": "success"}

    except Exception as e:
        print(e)
        return {"status": "error"}
@app.get("/")
def health():
    if db is None:
        return {"error": "Firestore is not connected. Add serviceAccountKey.json to your project."}

    # for p in patients:
    #     p_id, name, age, gender, native, phone = p

    #     db.collection("patients").document(f"p{p_id}").set({
    #         "name": name,
    #         "age": age,
    #         "gender": gender,
    #         "native": native,
    #         "phone": phone,
    #         "created_at": datetime.datetime.now(datetime.timezone.utc)
    #     })
    # for v in visit_history:
    #     p_id, visit_date, problem, medicine, prescription, amount = v

    #     db.collection("patients") \
    #     .document(f"p{p_id}") \
    #     .collection("visits") \
    #     .add({
    #         "visit_date": visit_date,
    #         "problem": problem,
    #         "medicine_given": medicine,
    #         "prescription": prescription,
    #         "amount_paid": amount,
    #         "created_at": datetime.datetime.now(datetime.timezone.utc)
    #     })
    return "ok"
from fastapi import Body

@app.post("/add_patient")
def add_patient(payload: dict = Body(...)):
    if db is None:
        return {"error": "DB not connected"}

    try:
        name = payload.get("name")
        age = payload.get("age")
        gender = payload.get("gender")
        native = payload.get("native")
        phone = payload.get("phone")

        if not all([name, age, gender, native, phone]):
            return {"error": "Missing fields"}

        # ---------- ID GENERATION ----------
        # use auto id → then convert to pX format
        new_ref = db.collection("patients").document()
        auto_id = new_ref.id

        doc_id = f"p{auto_id[:6]}"  # short readable id

        db.collection("patients").document(doc_id).set({
            "name": name,
            "age": age,
            "gender": gender,
            "native": native,
            "phone": phone,
            "created_at": datetime.datetime.now(datetime.timezone.utc)
        })

        return {"status": "success", "id": doc_id}

    except Exception as e:
        print(e)
        return {"error": "failed"}

@app.get("/all_pateints")
def all_patients():
    if db is None:
        print("Warning: Database not initialized.")
        return []

    try:
        # Fetch patients from Firestore 'patients' collection
        patients_ref = db.collection("patients")
        docs = patients_ref.stream()
        
        # Convert the documents to a list of dicts to return as JSON
        patient_list = []
        for doc in docs:
            patient_data = doc.to_dict()
            patient_data["id"] = doc.id
            
            # Fetch visit history for each patient, ordered by date descending (newest first)
            try:
                visits_ref = db.collection("patients").document(doc.id).collection("visits").order_by("visit_date", direction=firestore.Query.DESCENDING)
                visit_docs = visits_ref.stream()
                visits = []
                for v_doc in visit_docs:
                    v_data = v_doc.to_dict()
                    v_data["id"] = v_doc.id
                    visits.append(v_data)
                
                patient_data["visits"] = visits
            except Exception as e:
                print(f"Error fetching visits for patient {doc.id}: {e}")
                patient_data["visits"] = []
                
            patient_list.append(patient_data)
            
        return patient_list
    except Exception as e:
        print(f"Failed to fetch from Firestore: {e}")
        return []

@app.get("/search_patients")
def search_patients(by: str, value: str):
    if db is None:
        return []

    try:
        value = value.strip()
        if not value:
            return []

        patients_ref = db.collection("patients")
        patient_list = []

        # -------- ID search (FIXED) --------
        if by == "id":
            doc_id = value

            # FIX: allow numeric input like "2"
            if not doc_id.startswith("p"):
                doc_id = f"p{doc_id}"

            doc = patients_ref.document(doc_id).get()

            if doc.exists:
                p = doc.to_dict()
                p["id"] = doc.id
                patient_list.append(p)

        # -------- NAME / PHONE partial search (FIXED) --------
        elif by in ["name", "phone"]:

            value_lower = value.lower()

            # FIX: Firestore cannot do substring → fetch all
            docs = patients_ref.stream()

            for doc in docs:
                p = doc.to_dict()
                p["id"] = doc.id

                field_val = str(p.get(by, "")).lower()

                # REAL partial match
                if value_lower in field_val:
                    patient_list.append(p)

        else:
            return []

        # -------- Fetch visits --------
        for p in patient_list:
            try:
                visits_ref = patients_ref \
                    .document(p["id"]) \
                    .collection("visits") \
                    .order_by("visit_date", direction=firestore.Query.DESCENDING)

                visits = []
                for v_doc in visits_ref.stream():
                    v = v_doc.to_dict()
                    v["id"] = v_doc.id
                    visits.append(v)

                p["visits"] = visits

            except Exception:
                p["visits"] = []

        return patient_list

    except Exception as e:
        print("Search error:", e)
        return []

@app.delete("/delete_all")
def delete_all():
    if db is None:
        return {"status": "error", "message": "DB not connected"}
    
    try:
        patients_ref = db.collection("patients").stream()
        for p in patients_ref:
            # Delete subcollection visits
            visits_ref = db.collection("patients").document(p.id).collection("visits").stream()
            for v in visits_ref:
                db.collection("patients").document(p.id).collection("visits").document(v.id).delete()
            # Delete patient document
            db.collection("patients").document(p.id).delete()
            
        return {"status": "success", "message": "All patients and visits deleted"}
    except Exception as e:
        print("Delete all error:", e)
        return {"status": "error", "message": str(e)}

@app.delete("/delete_patient/{patient_id}")
def delete_patient(patient_id: str):
    if db is None:
        return {"status": "error", "message": "DB not connected"}

    try:
        if not patient_id.startswith("p"):
            patient_id = f"p{patient_id}"

        patient_ref = db.collection("patients").document(patient_id)
        patient_doc = patient_ref.get()
        if not patient_doc.exists:
            return {"status": "error", "message": "Patient not found"}

        visits_ref = patient_ref.collection("visits").stream()
        for visit in visits_ref:
            patient_ref.collection("visits").document(visit.id).delete()

        patient_ref.delete()
        return {"status": "success", "message": "Patient deleted"}
    except Exception as e:
        print("Delete patient error:", e)
        return {"status": "error", "message": str(e)}

@app.delete("/delete_visit/{patient_id}/{visit_id}")
def delete_visit(patient_id: str, visit_id: str):
    if db is None:
        return {"status": "error", "message": "DB not connected"}

    try:
        if not patient_id.startswith("p"):
            patient_id = f"p{patient_id}"

        visit_ref = db.collection("patients") \
            .document(patient_id) \
            .collection("visits") \
            .document(visit_id)

        visit_doc = visit_ref.get()
        if not visit_doc.exists:
            return {"status": "error", "message": "Visit not found"}

        visit_ref.delete()
        return {"status": "success", "message": "Visit deleted"}
    except Exception as e:
        print("Delete visit error:", e)
        return {"status": "error", "message": str(e)}
