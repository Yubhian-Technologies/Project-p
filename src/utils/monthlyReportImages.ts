export interface MonthlyReportPhoto {
  file: File;
  width: number;
  height: number;
}

export interface MonthlyReportPhotoRow {
  orientation: "landscape" | "portrait";
  photos: MonthlyReportPhoto[];
}

export async function loadMonthlyReportLogo(): Promise<Blob> {
  const response = await fetch("/monthly-report-logo.jpg");
  if (!response.ok) {
    throw new Error(`Could not load monthly report logo: ${response.status}`);
  }
  return response.blob();
}

export async function createMonthlyReportPhotoRows(
  files: File[],
): Promise<MonthlyReportPhotoRow[]> {
  const photos = await Promise.all(
    files.map(async (file): Promise<MonthlyReportPhoto> => {
      const bitmap = await createImageBitmap(file);
      const photo = { file, width: bitmap.width, height: bitmap.height };
      bitmap.close();
      return photo;
    }),
  );

  const rows: MonthlyReportPhotoRow[] = [];
  for (let index = 0; index < photos.length;) {
    const photo = photos[index];
    if (photo.width > photo.height) {
      rows.push({ orientation: "landscape", photos: [photo] });
      index += 1;
      continue;
    }

    const nextPhoto = photos[index + 1];
    if (nextPhoto && nextPhoto.width <= nextPhoto.height) {
      rows.push({ orientation: "portrait", photos: [photo, nextPhoto] });
      index += 2;
      continue;
    }

    rows.push({ orientation: "portrait", photos: [photo] });
    index += 1;
  }

  return rows;
}
