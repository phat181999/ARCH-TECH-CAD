package handlers

import (
	"io"
	"log/slog"
	"net/http"
	"path/filepath"
	"strings"

	"autocard-backend/services"
)

// CADHandler exposes file-conversion utilities (DWG/DWF → DXF).
type CADHandler struct{}

func NewCADHandler() *CADHandler {
	return &CADHandler{}
}

// Convert accepts a multipart file upload of a .dwg or .dwf file,
// converts it to DXF using the system-installed converter (LibreDWG
// or ODA File Converter), and returns the resulting DXF content as
// plain text so the frontend can feed it directly to dxfToElements().
//
//	POST /api/convert/cad
//	Content-Type: multipart/form-data
//	Form field:   file  (the .dwg or .dwf binary)
//
// Responses:
//
//	200 — text/plain DXF content
//	400 — missing/unsupported file
//	422 — converter not installed on server
//	500 — conversion runtime error
func (h *CADHandler) Convert(w http.ResponseWriter, r *http.Request) {
	// 50 MB max upload — generous for CAD files.
	if err := r.ParseMultipartForm(50 << 20); err != nil {
		http.Error(w, `{"error":"failed to parse multipart form: `+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		http.Error(w, `{"error":"file field is required"}`, http.StatusBadRequest)
		return
	}
	defer file.Close()

	fileName := header.Filename
	ext := strings.ToLower(filepath.Ext(fileName))

	slog.Info("CAD convert request", "file", fileName, "ext", ext, "size", header.Size)

	fileBytes, err := io.ReadAll(file)
	if err != nil {
		http.Error(w, `{"error":"failed to read uploaded file"}`, http.StatusInternalServerError)
		return
	}

	var dxfContent string

	switch ext {
	case ".dwg":
		converter := services.NewDWGConverter()
		if !converter.IsAvailable() {
			http.Error(w, `{"error":"DWG conversion is not available on this server. Please install LibreDWG (dwg2dxf) or ODA File Converter."}`, http.StatusUnprocessableEntity)
			return
		}
		converted, convErr := converter.Convert(fileBytes, fileName)
		if convErr != nil {
			slog.Error("DWG conversion failed", "file", fileName, "error", convErr)
			http.Error(w, `{"error":"DWG conversion failed: `+convErr.Error()+`"}`, http.StatusInternalServerError)
			return
		}
		dxfContent = converted

	case ".dwf":
		// DWF is a compressed, view-only format. No reliable open-source
		// converter exists. Return a clear error so the frontend can show
		// a helpful dialog.
		http.Error(w, `{"error":"DWF is a view-only format and cannot be converted to DXF automatically. Please export your drawing as DWG or DXF from the original CAD software."}`, http.StatusUnprocessableEntity)
		return

	default:
		http.Error(w, `{"error":"unsupported file type: `+ext+`. Only .dwg and .dwf files need conversion. DXF files can be imported directly."}`, http.StatusBadRequest)
		return
	}

	slog.Info("CAD conversion successful", "file", fileName, "dxfLen", len(dxfContent))

	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(dxfContent))
}
