## API Usage

### Generate Report

**Endpoint**

```http
POST /reports
```

**Content-Type**

```text
multipart/form-data
```

The request consists of regular form fields and one or more image files.

| Field          | Type     | Required | Description                                                        |
| -------------- | -------- | -------- | ------------------------------------------------------------------ |
| `name`         | string   | ✅       | Report name. Used as the output PDF filename.                      |
| `sensor_count` | integer  | ✅       | Number of sensors used in the experiment.                          |
| `titles`       | string[] | ✅       | One title for each uploaded image.                                 |
| `images`       | file[]   | ✅       | Plot images. The number of images must match the number of titles. |

> **Important:** `titles` must be sent as **multiple form fields**, **not** as a comma-separated string.

### Correct example

```bash
curl -X POST http://localhost:5050/reports \
  -H "accept: application/pdf" \
  -F "name=Lemon" \
  -F "sensor_count=16" \
  -F "titles=Strongest per-measurement sensor response" \
  -F "titles=Single response curve with extracted features" \
  -F "titles=Baseline normalization" \
  -F "images=@app/examples/1.png" \
  -F "images=@app/examples/2.png" \
  -F "images=@app/examples/3.png" \
  --output report.pdf
```

### Incorrect example

Do **not** send titles as a single comma-separated value:

```bash
-F "titles=Title 1,Title 2,Title 3"
```

Instead, repeat the `titles` field once for each image:

```bash
-F "titles=Title 1"
-F "titles=Title 2"
-F "titles=Title 3"
```

### Response

On success, the service returns a PDF document.

**Content-Type**

```text
application/pdf
```

The response includes the `Content-Disposition` header so the browser or client can download the generated report.

### Example Report

**Endpoint**

```http
GET /example
```

Returns a sample PDF generated from the bundled example images. This endpoint is intended for quickly verifying that the service is running correctly and demonstrating the report layout.

### Example

```bash
curl -X GET http://localhost:5050/example \
  -H "accept: application/pdf" \
  --output example.pdf
```

### Response

On success, the service returns a PDF document.

**Content-Type**

```text
application/pdf
```

**Filename**

```text
example.pdf
```
