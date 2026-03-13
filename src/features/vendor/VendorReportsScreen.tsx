import React, { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { fetchVendorManualOfficeReport, fetchVendorManualReportOffices } from '../../api/vendorApi';
import { useVendorApp } from '../../context/VendorAppContext';
import { Building, ManualOfficeDirectoryItem, ManualOfficeReport } from '../../types/vendor';
import { formatCurrency, formatDateTime } from '../../utils/format';
import { useAutoClearValue } from '../../utils/useAutoClearValue';
import { useDebouncedValue } from '../../utils/useDebouncedValue';
import { ActionButton, Field, SectionTitle } from '../shared/ui';
import { tokens } from '../shared/tokens';

interface VendorReportsScreenProps {
  onBack: () => void;
}

export function VendorReportsScreen({ onBack }: VendorReportsScreenProps) {
  const { buildings } = useVendorApp();
  const [selectedBuildingId, setSelectedBuildingId] = useState<number | undefined>(undefined);
  const [query, setQuery] = useState('');
  const [availableBuildings, setAvailableBuildings] = useState<Building[]>([]);
  const [offices, setOffices] = useState<ManualOfficeDirectoryItem[]>([]);
  const [selectedOffice, setSelectedOffice] = useState<ManualOfficeDirectoryItem | null>(null);
  const [report, setReport] = useState<ManualOfficeReport | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debouncedQuery = useDebouncedValue(query, 350);

  useAutoClearValue(error, () => setError(null));

  const buildingOptions = availableBuildings.length ? availableBuildings : buildings;
  const hasSearchQuery = query.trim().length > 0;
  const compactResults = useMemo(() => (hasSearchQuery ? offices.slice(0, 6) : []), [hasSearchQuery, offices]);

  useEffect(() => {
    if (!buildingOptions.length) {
      setSelectedBuildingId(undefined);
      return;
    }

    if (!selectedBuildingId || !buildingOptions.some((building) => building.id === selectedBuildingId)) {
      setSelectedBuildingId(buildingOptions[0].id);
    }
  }, [buildingOptions, selectedBuildingId]);

  useEffect(() => {
    void loadOffices();
  }, [selectedBuildingId, debouncedQuery]);

  useEffect(() => {
    if (selectedOffice?.office_id) {
      void loadReport(selectedOffice.office_id);
      return;
    }

    setReport(null);
  }, [selectedOffice]);

  async function loadOffices(options?: { preserveSelection?: boolean }): Promise<void> {
    const preserveSelection = options?.preserveSelection ?? true;
    setLoadingList(true);
    setError(null);

    try {
      const data = await fetchVendorManualReportOffices({
        buildingId: selectedBuildingId,
        query: debouncedQuery,
      });
      setAvailableBuildings(data.buildings);
      setOffices(data.offices);

      if (preserveSelection && selectedOffice) {
        const refreshedSelected =
          data.offices.find((office) => office.office_id === selectedOffice.office_id) ?? selectedOffice;
        setSelectedOffice(refreshedSelected);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load report offices.');
    } finally {
      setLoadingList(false);
    }
  }

  async function loadReport(officeId: number): Promise<void> {
    setLoadingReport(true);
    setError(null);

    try {
      const data = await fetchVendorManualOfficeReport(officeId);
      setReport(data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load report.');
      setReport(null);
    } finally {
      setLoadingReport(false);
    }
  }

  async function downloadPdf(): Promise<void> {
    if (!report?.download_url) {
      setError('PDF download is not ready yet.');
      return;
    }

    setDownloading(true);
    setError(null);

    try {
      await Linking.openURL(report.download_url);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'Could not open PDF download.');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <SectionTitle title="Reports" subtitle="Track pending tea and coffee amount office-wise and download PDF" />
          <ActionButton label="Back" tone="muted" onPress={onBack} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Find Office</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {buildingOptions.map((building) => {
              const isActive = selectedBuildingId === building.id;
              return (
                <Pressable
                  key={building.id}
                  onPress={() => {
                    setSelectedBuildingId(building.id);
                    setSelectedOffice(null);
                    setQuery('');
                  }}
                  style={[styles.filterChip, isActive ? styles.filterChipActive : null]}
                >
                  <Text style={[styles.filterChipText, isActive ? styles.filterChipTextActive : null]}>
                    {building.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {!selectedOffice ? (
            <>
              <Field
                label="Search Office"
                icon="search-outline"
                value={query}
                onChangeText={setQuery}
                placeholder="Search office number like 202"
              />

              {compactResults.length ? (
                <View style={styles.listWrap}>
                  {compactResults.map((office) => (
                    <Pressable
                      key={office.office_id}
                      onPress={() => {
                        setSelectedOffice(office);
                        setQuery('');
                      }}
                      style={styles.officeResultItem}
                    >
                      <View style={styles.officeResultBody}>
                        <Text style={styles.officeName}>Office {office.office_name}</Text>
                        <Text style={styles.officeMeta}>{office.label}</Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              ) : hasSearchQuery ? (
                <Text style={styles.emptyText}>{loadingList ? 'Loading offices...' : 'No office match found.'}</Text>
              ) : null}
            </>
          ) : (
            <View style={styles.selectedOfficeCard}>
              <View style={styles.summaryHeader}>
                <View style={styles.summaryHeaderBody}>
                  <Text style={styles.selectedOfficeLabel}>Selected Office</Text>
                  <Text style={styles.cardTitle}>Office {selectedOffice.office_name}</Text>
                  <Text style={styles.summaryMeta}>{selectedOffice.label}</Text>
                </View>
                <Pressable
                  style={styles.changeButton}
                  onPress={() => {
                    setSelectedOffice(null);
                    setQuery('');
                    setReport(null);
                  }}
                >
                  <Text style={styles.changeButtonText}>Change</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>

        {selectedOffice ? (
          <View style={styles.card}>
            <View style={styles.summaryHeader}>
              <View style={styles.summaryHeaderBody}>
                <Text style={styles.cardTitle}>{selectedOffice.office_name}</Text>
                <Text style={styles.summaryMeta}>{selectedOffice.label}</Text>
              </View>
              <ActionButton
                label={downloading ? 'Opening PDF...' : 'Download PDF'}
                onPress={() => {
                  void downloadPdf();
                }}
                disabled={downloading || !report?.download_url}
                style={styles.downloadButton}
              />
            </View>

            {loadingReport ? (
              <Text style={styles.emptyText}>Loading report...</Text>
            ) : report ? (
              <>
                <View style={styles.summaryRow}>
                  <View style={styles.summaryCard}>
                    <Text style={styles.summaryLabel}>Pending</Text>
                    <Text style={styles.summaryValue}>{formatCurrency(report.summary.pending_amount)}</Text>
                  </View>
                  <View style={styles.summaryCard}>
                    <Text style={styles.summaryLabel}>Tea</Text>
                    <Text style={styles.summaryValue}>{report.summary.tea_qty}</Text>
                  </View>
                  <View style={styles.summaryCard}>
                    <Text style={styles.summaryLabel}>Coffee</Text>
                    <Text style={styles.summaryValue}>{report.summary.coffee_qty}</Text>
                  </View>
                </View>

                <View style={styles.metaCard}>
                  <Text style={styles.metaTitle}>Tracking</Text>
                  <Text style={styles.metaText}>Entries: {report.summary.orders_count}</Text>
                  <Text style={styles.metaText}>Total billed: {formatCurrency(report.summary.total_amount)}</Text>
                  <Text style={styles.metaText}>Paid: {formatCurrency(report.summary.paid_amount)}</Text>
                  <Text style={styles.metaText}>
                    Last updated: {report.summary.last_ordered_at ? formatDateTime(report.summary.last_ordered_at) : '--'}
                  </Text>
                </View>

              </>
            ) : (
              <Text style={styles.emptyText}>Select an office to view the report.</Text>
            )}
          </View>
        ) : null}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: tokens.colors.appBg,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
    gap: 12,
  },
  headerRow: {
    gap: 10,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#ececf0',
    padding: 14,
    gap: 12,
  },
  cardTitle: {
    color: '#222329',
    fontSize: 18,
    fontWeight: '900',
  },
  chipRow: {
    gap: 8,
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e3e3e8',
    backgroundColor: '#f6f6f8',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterChipActive: {
    borderColor: '#ffc18c',
    backgroundColor: '#fff1e5',
  },
  filterChipText: {
    color: '#74747f',
    fontSize: 12,
    fontWeight: '700',
  },
  filterChipTextActive: {
    color: tokens.colors.vendorPrimary,
  },
  listWrap: {
    gap: 8,
  },
  officeResultItem: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ececf0',
    backgroundColor: '#f8f8fa',
    padding: 12,
  },
  officeResultBody: {
    gap: 4,
  },
  officeName: {
    color: '#222329',
    fontSize: 15,
    fontWeight: '800',
  },
  officeMeta: {
    color: '#74747f',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
  selectedOfficeCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d9e3ff',
    backgroundColor: '#f7faff',
    padding: 12,
  },
  selectedOfficeLabel: {
    color: '#6376f6',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  changeButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#cfd9ff',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  changeButtonText: {
    color: '#6376f6',
    fontSize: 12,
    fontWeight: '800',
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  summaryHeaderBody: {
    flex: 1,
    gap: 4,
  },
  summaryMeta: {
    color: '#767680',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
  downloadButton: {
    minWidth: 130,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: '#fff6ef',
    padding: 12,
    gap: 4,
  },
  summaryLabel: {
    color: '#8a5a32',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  summaryValue: {
    color: tokens.colors.vendorPrimary,
    fontSize: 18,
    fontWeight: '900',
  },
  metaCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ececf0',
    backgroundColor: '#fbfbfd',
    padding: 12,
    gap: 6,
  },
  metaTitle: {
    color: '#222329',
    fontSize: 14,
    fontWeight: '800',
  },
  metaText: {
    color: '#70707a',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyText: {
    color: '#8d8d97',
    fontSize: 13,
    fontWeight: '600',
  },
  errorText: {
    color: tokens.colors.danger,
    fontSize: 13,
    fontWeight: '700',
  },
});
