/**
 * Helper for Google Drive API interaction using OAuth access token.
 * Creates folder hierarchy: absen > [Bulan, e.g. September 2026] > [Periode, e.g. Periode 01-05 September 2026]
 * and uploads weekly attendance PDF documents.
 */

async function handleApiError(response: Response, actionName: string) {
  if (response.ok) return;
  const errText = await response.text();
  if (
    errText.includes("accessNotConfigured") ||
    errText.includes("has not been used in project") ||
    errText.includes("disabled")
  ) {
    throw new Error(
      `GOOGLE_DRIVE_API_DISABLED: Google Drive API belum aktif pada project. Silakan buka Google Cloud Console untuk mengaktifkan Google Drive API.`
    );
  }
  if (
    response.status === 401 ||
    errText.includes("401") ||
    errText.includes("UNAUTHENTICATED") ||
    errText.includes("Invalid Credentials") ||
    errText.includes("invalid_grant")
  ) {
    throw new Error("TOKEN_EXPIRED_401: Token Google Drive telah kedaluwarsa atau belum terautentikasi. Silakan hubungkan ulang Google Drive.");
  }
  throw new Error(`Gagal ${actionName}: ${errText}`);
}

// Create a folder in Google Drive
export async function createGoogleDriveFolder(accessToken: string, folderName: string, parentId?: string): Promise<string> {
  const metadata: any = {
    name: folderName,
    mimeType: "application/vnd.google-apps.folder",
  };
  if (parentId) {
    metadata.parents = [parentId];
  }
  const response = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(metadata),
  });
  await handleApiError(response, `membuat folder "${folderName}" di Google Drive`);
  const data = await response.json();
  return data.id;
}

// Check if folder exists, otherwise create it
export async function getOrCreateFolder(accessToken: string, folderName: string, parentId?: string): Promise<string> {
  let queryStr = `name = '${folderName.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  if (parentId) {
    queryStr += ` and '${parentId}' in parents`;
  }
  const query = encodeURIComponent(queryStr);
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${query}&spaces=drive&fields=files(id,name)`;
  const response = await fetch(searchUrl, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  await handleApiError(response, `mencari folder "${folderName}" di Google Drive`);
  const data = await response.json();
  if (data.files && data.files.length > 0) {
    return data.files[0].id;
  }
  return await createGoogleDriveFolder(accessToken, folderName, parentId);
}

// Build nested folders: e.g. ["absen", "September 2026", "Periode 01-05 September 2026"]
export async function getOrCreateNestedFolder(accessToken: string, folderNames: string[]): Promise<string> {
  let currentParentId: string | undefined = undefined;
  for (const name of folderNames) {
    currentParentId = await getOrCreateFolder(accessToken, name, currentParentId);
  }
  return currentParentId!;
}

// Upload or update a PDF Blob in Google Drive without creating duplicates
export async function uploadPdfToDrive(
  accessToken: string,
  folderId: string,
  fileName: string,
  pdfBlob: Blob
): Promise<{ id: string; name: string; webViewLink: string }> {
  // Check if file already exists in this folder
  const queryStr = `name = '${fileName.replace(/'/g, "\\'")}' and '${folderId}' in parents and trashed = false`;
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(queryStr)}&spaces=drive&fields=files(id,name,webViewLink)`;
  
  try {
    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (searchRes.ok) {
      const searchData: any = await searchRes.json();
      if (searchData.files && searchData.files.length > 0) {
        const existingFile = searchData.files[0];
        // Update existing file in-place
        const patchRes = await fetch(
          `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=media&fields=id,name,webViewLink`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/pdf",
            },
            body: pdfBlob,
          }
        );
        await handleApiError(patchRes, `memperbarui berkas PDF "${fileName}" di Google Drive`);
        const updatedData = await patchRes.json();
        return {
          id: updatedData.id || existingFile.id,
          name: fileName,
          webViewLink: updatedData.webViewLink || existingFile.webViewLink || `https://drive.google.com/file/d/${existingFile.id}/view`,
        };
      }
    }
  } catch (e: any) {
    console.warn("Pencarian berkas lama di Google Drive dilewati:", e.message);
  }

  // File does not exist, upload as multipart
  const metadata = {
    name: fileName,
    parents: [folderId],
    mimeType: "application/pdf",
  };
  const formData = new FormData();
  formData.append(
    "metadata",
    new Blob([JSON.stringify(metadata)], { type: "application/json" })
  );
  formData.append("file", pdfBlob, fileName);

  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData,
    }
  );
  await handleApiError(response, `mengunggah berkas PDF "${fileName}" ke Google Drive`);
  return await response.json();
}

/**
 * Saves Friday weekly attendance report PDF to Google Drive with the requested folder hierarchy:
 * absen > [Bulan] > [Periode]
 */
export async function saveFridayReportToGoogleDrive(
  accessToken: string,
  monthName: string,
  periodName: string,
  fileName: string,
  pdfBlob: Blob
): Promise<{ fileId: string; driveUrl: string; folderPath: string }> {
  // Folder hierarchy: absen > Bulan > Periode
  const folderNames = ["absen", monthName, periodName];
  const targetFolderId = await getOrCreateNestedFolder(accessToken, folderNames);
  const result = await uploadPdfToDrive(accessToken, targetFolderId, fileName, pdfBlob);
  return {
    fileId: result.id,
    driveUrl: result.webViewLink || `https://drive.google.com/file/d/${result.id}/view`,
    folderPath: `absen > ${monthName} > ${periodName}`,
  };
}
