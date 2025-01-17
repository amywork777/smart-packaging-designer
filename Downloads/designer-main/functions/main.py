from firebase_functions import https_fn, options
from firebase_admin import initialize_app, storage
from gradio_client import Client, handle_file
import time
import json
import requests
import tempfile
import os

# Increase timeout to maximum (540 seconds = 9 minutes)
options.set_global_options(
    region="us-central1",
    memory=2048,  # 2 GiB
    timeout_sec=540  # 9 minutes
)

# Initialize Firebase Admin using Application Default Credentials.
app = initialize_app(options={
    'storageBucket': 'taiyaki-test1.firebasestorage.app'
})

def upload_to_firebase(local_path, destination_path):
    """
    Upload a file to Firebase Storage and return its public URL.
    Note: This assumes your bucket is publicly readable via IAM
    (allUsers: roles/storage.objectViewer).
    """
    try:
        bucket = storage.bucket()
        blob = bucket.blob(destination_path)
        blob.upload_from_filename(local_path)
        public_url = f"https://storage.googleapis.com/{bucket.name}/{destination_path}"
        return public_url
    except Exception as e:
        print(f"Error uploading to Firebase: {e}")
        raise

def retry_operation(operation, max_attempts=3):
    """Retry an operation with exponential backoff"""
    for attempt in range(max_attempts):
        try:
            return operation()
        except Exception as e:
            if attempt == max_attempts - 1:  # Last attempt
                raise  # Re-raise the last exception
            print(f"Attempt {attempt + 1} failed: {str(e)}")
            time.sleep(2 ** attempt)  # Exponential backoff: 1, 2, 4 seconds

@https_fn.on_request()
def process_3d(request: https_fn.Request) -> https_fn.Response:
    """Process 3D endpoint with streaming results"""
    if request.method == 'OPTIONS':
        headers = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST',
            'Access-Control-Allow-Headers': 'Content-Type',
        }
        return https_fn.Response('', status=204, headers=headers)

    headers = {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
    }

    temp_files = []

    try:
        client = Client("eleelenawa/TRELLIS")

        print("Starting session...")
        session_result = client.predict(api_name="/start_session")
        time.sleep(2)

        request_json = request.get_json()
        image_url = request_json.get('image_url')
        user_id = request_json.get('userId', 'default')
        
        if not image_url:
            return https_fn.Response(
                json.dumps({"error": "No image URL provided"}),
                headers=headers,
                status=400
            )

        timestamp = int(time.time() * 1000)
        
        # Download and preprocess image
        print(f"Downloading image from: {image_url}")
        response = requests.get(image_url, stream=True, timeout=300)
        response.raise_for_status()
        
        temp_path = os.path.join(tempfile.gettempdir(), f"temp_image_{timestamp}.png")
        temp_files.append(temp_path)
        
        with open(temp_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)

        # Preprocessing Step
        print("Starting preprocessing...")
        job = client.submit(
            image=handle_file(temp_path),
            api_name="/preprocess_image"
        )
        preprocessed_result = job.result(timeout=300)

        if isinstance(preprocessed_result, (list, tuple)):
            preprocessed_path = preprocessed_result[0]
        else:
            preprocessed_path = preprocessed_result

        temp_files.append(preprocessed_path)
        preprocessed_url = upload_to_firebase(
            preprocessed_path,
            f"processed/{user_id}/{timestamp}/preprocessed.png"
        )

        # 3D Generation Step
        print("Starting 3D generation...")
        job = client.submit(
            image=handle_file(temp_path),
            multiimages=[],
            seed=0,
            ss_guidance_strength=7.5,
            ss_sampling_steps=12,
            slat_guidance_strength=3,
            slat_sampling_steps=12,
            multiimage_algo="stochastic",
            api_name="/image_to_3d"
        )
        three_d_result = job.result(timeout=600)
        video_path = three_d_result['video']
        temp_files.append(video_path)

        video_url = upload_to_firebase(
            video_path,
            f"processed/{user_id}/{timestamp}/preview.mp4"
        )

        # Send immediate response with video URL
        print("Video ready, sending response...")
        response = https_fn.Response(
            json.dumps({
                "success": True,
                "status": "video_ready",
                "video_url": video_url,
                "timestamp": timestamp,
                "userId": user_id
            }),
            headers=headers,
            status=200
        )

        # Continue processing GLB in the background
        print("Starting GLB extraction...")
        try:
            job = client.submit(
                0.95,
                1024,
                api_name="/extract_glb"
            )
            glb_result = job.result(timeout=600)

            glb_urls = []
            if isinstance(glb_result, (list, tuple)):
                for idx, one_glb in enumerate(glb_result):
                    temp_files.append(one_glb)
                    glb_url = upload_to_firebase(
                        one_glb,
                        f"processed/{user_id}/{timestamp}/model_{idx}.glb"
                    )
                    glb_urls.append(glb_url)
            else:
                temp_files.append(glb_result)
                glb_url = upload_to_firebase(
                    glb_result,
                    f"processed/{user_id}/{timestamp}/model.glb"
                )
                glb_urls = [glb_url]

            print("GLB files ready:", glb_urls)
        except Exception as e:
            print(f"Error extracting GLB (but video was successful): {e}")

        return response

    except Exception as e:
        print(f"Error: {e}")
        print(f"Error type: {type(e)}")
        return https_fn.Response(
            json.dumps({
                "error": str(e),
                "error_type": str(type(e))
            }),
            headers=headers,
            status=500
        )
        
    finally:
        for temp_file in temp_files:
            if temp_file and os.path.exists(temp_file):
                try:
                    os.remove(temp_file)
                    print(f"Cleaned up: {temp_file}")
                except Exception as e:
                    print(f"Error cleaning up file: {e}")