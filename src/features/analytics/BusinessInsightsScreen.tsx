import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  fetchVendorBusinessInsights,
  fetchWeeklyReport,
} from '../../api/analyticsApi';
import {
  AnalyticsDateRangeKey,
  BuildingAnalyticsItem,
  BuildingOpportunityItem,
  DailySalesPoint,
  HourlyActivityItem,
  MissedDemandItem,
  ProductMetricItem,
  ProductMatrixData,
  SearchQueryItem,
  SmartInsightItem,
  VendorBusinessInsights,
  WeeklyReportData,
} from '../../types/analytics';
import { VendorTabKey } from '../../types/workflow';
import { formatCurrency } from '../../utils/format';
import { tokens } from '../shared/tokens';

interface BusinessInsightsScreenProps {
  onBack: () => void;
  onNavigateToTab?: (tab: VendorTabKey, params?: Record<string, unknown>) => void;
}

type MainTabKey = 'overview' | 'products' | 'demand' | 'growth';

const DATE_RANGE_TABS: Array<{ key: AnalyticsDateRangeKey; label: string }> = [
  { key: 'last_30_days', label: 'Last 30 Days (Default)' },
  { key: 'last_7_days', label: 'Last 7 Days' },
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'this_month', label: 'This Month' },
  { key: 'last_month', label: 'Last Month' },
  { key: 'custom', label: '📅 Custom Range' },
];

const PRODUCTS_PAGE_SIZE = 12;

export function BusinessInsightsScreen({ onBack, onNavigateToTab }: BusinessInsightsScreenProps) {
  // Navigation & Filtering State
  const [selectedRange, setSelectedRange] = useState<AnalyticsDateRangeKey>('last_30_days');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [isCustomDateModalOpen, setIsCustomDateModalOpen] = useState(false);

  // Active top-level tab
  const [activeTab, setActiveTab] = useState<MainTabKey>('overview');

  // Products tab specific state
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [productStatusFilter, setProductStatusFilter] = useState<'all' | 'selling' | 'attention' | 'low'>('all');
  const [productSortBy, setProductSortBy] = useState<'orders' | 'revenue' | 'views'>('orders');
  const [productViewMode, setProductViewMode] = useState<'list' | 'matrix'>('list');
  const [visibleProductCount, setVisibleProductCount] = useState(PRODUCTS_PAGE_SIZE);

  // Active matrix quadrant tab (when inside matrix view)
  const [activeMatrixTab, setActiveMatrixTab] = useState<'star_products' | 'needs_attention' | 'hidden_performers' | 'low_activity'>('star_products');

  // Data State
  const [insights, setInsights] = useState<VendorBusinessInsights | null>(null);
  const [weeklyReport, setWeeklyReport] = useState<WeeklyReportData | null>(null);
  const [weeklyModalVisible, setWeeklyModalVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(
    async (
      range: AnalyticsDateRangeKey,
      silent = false,
      startDate?: string,
      endDate?: string
    ) => {
      if (!silent) {
        setIsLoading(true);
      }
      setError(null);

      try {
        const data = await fetchVendorBusinessInsights({
          range,
          startDate: range === 'custom' ? startDate : undefined,
          endDate: range === 'custom' ? endDate : undefined,
        });
        setInsights(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load analytics.');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    if (selectedRange !== 'custom') {
      void loadData(selectedRange);
    }
  }, [selectedRange, loadData]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    void loadData(
      selectedRange,
      true,
      selectedRange === 'custom' ? customStartDate : undefined,
      selectedRange === 'custom' ? customEndDate : undefined
    );
  }, [selectedRange, customStartDate, customEndDate, loadData]);

  const handleApplyCustomDates = () => {
    if (!customStartDate.trim() || !customEndDate.trim()) {
      return;
    }
    setIsCustomDateModalOpen(false);
    setSelectedRange('custom');
    void loadData('custom', false, customStartDate.trim(), customEndDate.trim());
  };

  const handleOpenWeeklyReport = async () => {
    try {
      const report = await fetchWeeklyReport();
      setWeeklyReport(report);
      setWeeklyModalVisible(true);
    } catch {
      // Fallback
    }
  };

  // Compile full products pool
  const allProductsList = useMemo(() => {
    if (insights?.all_products && insights.all_products.length > 0) {
      return insights.all_products;
    }

    // Fallback deduplicated from top_products, most_viewed, most_purchased, matrix
    const map = new Map<number, ProductMetricItem>();
    const appendList = (list?: ProductMetricItem[]) => {
      if (!list) return;
      for (const item of list) {
        if (!map.has(item.id)) {
          map.set(item.id, item);
        }
      }
    };

    appendList(insights?.top_products);
    appendList(insights?.most_purchased_products);
    appendList(insights?.most_viewed_products);
    if (insights?.product_matrix) {
      appendList(insights.product_matrix.star_products?.items);
      appendList(insights.product_matrix.needs_attention?.items);
      appendList(insights.product_matrix.hidden_performers?.items);
      appendList(insights.product_matrix.low_activity?.items);
    }

    return Array.from(map.values());
  }, [insights]);

  // Derive available categories
  const categoryOptions = useMemo(() => {
    const categoriesSet = new Set<string>();
    if (insights?.available_categories && insights.available_categories.length > 0) {
      insights.available_categories.forEach((cat) => {
        if (cat.name) categoriesSet.add(cat.name);
      });
    }
    allProductsList.forEach((prod) => {
      if (prod.category_name) {
        categoriesSet.add(prod.category_name);
      }
    });

    return Array.from(categoriesSet);
  }, [insights, allProductsList]);

  // Filtered and Sorted products
  const filteredProducts = useMemo(() => {
    let list = [...allProductsList];

    // Search filter
    if (productSearchQuery.trim()) {
      const query = productSearchQuery.toLowerCase().trim();
      list = list.filter((p) =>
        p.name.toLowerCase().includes(query) ||
        (p.category_name && p.category_name.toLowerCase().includes(query))
      );
    }

    // Category filter
    if (selectedCategoryFilter !== 'all') {
      list = list.filter((p) => p.category_name === selectedCategoryFilter);
    }

    // Status filter
    if (productStatusFilter === 'selling') {
      list = list.filter((p) => p.orders > 0);
    } else if (productStatusFilter === 'attention') {
      list = list.filter((p) => p.views >= 3 && p.orders === 0);
    } else if (productStatusFilter === 'low') {
      list = list.filter((p) => p.orders === 0 && p.views < 3);
    }

    // Sorting
    if (productSortBy === 'orders') {
      list.sort((a, b) => b.orders - a.orders || b.revenue - a.revenue);
    } else if (productSortBy === 'revenue') {
      list.sort((a, b) => b.revenue - a.revenue || b.orders - a.orders);
    } else if (productSortBy === 'views') {
      list.sort((a, b) => b.views - a.views || b.orders - a.orders);
    }

    return list;
  }, [allProductsList, productSearchQuery, selectedCategoryFilter, productStatusFilter, productSortBy]);

  // Paginated visible products
  const paginatedProducts = useMemo(() => {
    return filteredProducts.slice(0, visibleProductCount);
  }, [filteredProducts, visibleProductCount]);

  const overview = insights?.overview;
  const funnel = insights?.store_performance;
  const todaySoFar = insights?.today_so_far;
  const searchAnalytics = insights?.search_analytics;
  const matrix = insights?.product_matrix;
  const engagement = insights?.customer_engagement;
  const customerActivity = insights?.customer_activity;
  const salesOverview = insights?.sales_overview;

  const maxHourlyOrders = Math.max(1, ...(engagement?.hourly_activity?.map((h) => h.orders) ?? [1]));
  const maxDailySales = Math.max(1, ...(salesOverview?.daily_points?.map((d) => d.sales) ?? [1]));

  return (
    <View style={styles.root}>
      {/* Header Bar */}
      <View style={styles.headerBar}>
        <Pressable onPress={onBack} hitSlop={12} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color="#1e293b" />
        </Pressable>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Business Analytics</Text>
          <Text style={styles.headerSubtitle}>
            {insights?.date_range?.label
              ? `${insights.date_range.label} (${insights.date_range.start_date} to ${insights.date_range.end_date})`
              : 'Performance & demand insights'}
          </Text>
        </View>
        <Pressable onPress={handleOpenWeeklyReport} style={styles.weeklyReportBadgeButton}>
          <Ionicons name="calendar-outline" size={16} color={tokens.colors.vendorPrimary} />
          <Text style={styles.weeklyReportBadgeText}>Report</Text>
        </Pressable>
      </View>

      {/* Date Filter Pills */}
      <View style={styles.dateFilterContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dateFilterContent}
        >
          {DATE_RANGE_TABS.map((tab) => {
            const isActive = tab.key === selectedRange;
            return (
              <Pressable
                key={tab.key}
                onPress={() => {
                  if (tab.key === 'custom') {
                    setIsCustomDateModalOpen(true);
                  } else {
                    setSelectedRange(tab.key);
                  }
                }}
                style={[styles.datePill, isActive ? styles.datePillActive : null]}
              >
                <Text style={[styles.datePillText, isActive ? styles.datePillTextActive : null]}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Main Segmented Navigation Bar (Solves "ek page ma badhu no apo") */}
      <View style={styles.segmentNavBar}>
        <Pressable
          style={[styles.segmentNavBtn, activeTab === 'overview' && styles.segmentNavBtnActive]}
          onPress={() => setActiveTab('overview')}
        >
          <Ionicons
            name="bar-chart-outline"
            size={16}
            color={activeTab === 'overview' ? tokens.colors.vendorPrimary : '#64748b'}
          />
          <Text
            style={[styles.segmentNavText, activeTab === 'overview' && styles.segmentNavTextActive]}
          >
            Overview
          </Text>
        </Pressable>

        <Pressable
          style={[styles.segmentNavBtn, activeTab === 'products' && styles.segmentNavBtnActive]}
          onPress={() => setActiveTab('products')}
        >
          <Ionicons
            name="cube-outline"
            size={16}
            color={activeTab === 'products' ? tokens.colors.vendorPrimary : '#64748b'}
          />
          <Text
            style={[styles.segmentNavText, activeTab === 'products' && styles.segmentNavTextActive]}
          >
            Products ({allProductsList.length})
          </Text>
        </Pressable>

        <Pressable
          style={[styles.segmentNavBtn, activeTab === 'demand' && styles.segmentNavBtnActive]}
          onPress={() => setActiveTab('demand')}
        >
          <Ionicons
            name="search-outline"
            size={16}
            color={activeTab === 'demand' ? tokens.colors.vendorPrimary : '#64748b'}
          />
          <Text
            style={[styles.segmentNavText, activeTab === 'demand' && styles.segmentNavTextActive]}
          >
            Demand
          </Text>
        </Pressable>

        <Pressable
          style={[styles.segmentNavBtn, activeTab === 'growth' && styles.segmentNavBtnActive]}
          onPress={() => setActiveTab('growth')}
        >
          <Ionicons
            name="business-outline"
            size={16}
            color={activeTab === 'growth' ? tokens.colors.vendorPrimary : '#64748b'}
          />
          <Text
            style={[styles.segmentNavText, activeTab === 'growth' && styles.segmentNavTextActive]}
          >
            Growth
          </Text>
        </Pressable>
      </View>

      {/* Main Content Area */}
      {isLoading && !isRefreshing ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={tokens.colors.vendorPrimary} />
          <Text style={styles.loadingText}>Calculating business insights...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorWrap}>
          <Ionicons name="alert-circle-outline" size={44} color="#ef4444" />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={() => loadData(selectedRange)}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={[tokens.colors.vendorPrimary]}
            />
          }
        >
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <>
              {/* Today So Far Real-time Widget */}
              {todaySoFar ? (
                <View style={styles.todayCard}>
                  <View style={styles.todayHeaderRow}>
                    <View style={styles.todayLiveWrap}>
                      <View style={styles.liveDot} />
                      <Text style={styles.todayLiveText}>TODAY SO FAR</Text>
                    </View>
                    <Text style={styles.todayUpdatedText}>Updated {todaySoFar.last_updated_human}</Text>
                  </View>
                  <View style={styles.todayStatsRow}>
                    <View style={styles.todayStatCol}>
                      <Text style={styles.todayStatVal}>{todaySoFar.store_views}</Text>
                      <Text style={styles.todayStatLbl}>Store Views</Text>
                    </View>
                    <View style={styles.todayStatCol}>
                      <Text style={styles.todayStatVal}>{todaySoFar.product_views}</Text>
                      <Text style={styles.todayStatLbl}>Product Views</Text>
                    </View>
                    <View style={styles.todayStatCol}>
                      <Text style={styles.todayStatVal}>{todaySoFar.orders}</Text>
                      <Text style={styles.todayStatLbl}>Orders</Text>
                    </View>
                    <View style={styles.todayStatCol}>
                      <Text style={[styles.todayStatVal, { color: tokens.colors.vendorPrimary }]}>
                        ₹{todaySoFar.sales.toLocaleString('en-IN')}
                      </Text>
                      <Text style={styles.todayStatLbl}>Sales</Text>
                    </View>
                  </View>
                </View>
              ) : null}

              {/* Main KPI Cards */}
              <View style={styles.sectionWrap}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionHeading}>Business KPI Overview</Text>
                  {overview?.comparison_label ? (
                    <Text style={styles.comparisonBadge}>{overview.comparison_label}</Text>
                  ) : null}
                </View>

                <View style={styles.kpiGrid}>
                  <KpiCard
                    title="Store Views"
                    value={overview?.store_views.value ?? 0}
                    delta={overview?.store_views.growth_pct ?? 0}
                    icon="eye-outline"
                    color="#6366f1"
                  />
                  <KpiCard
                    title="Unique Visitors"
                    value={overview?.unique_visitors.value ?? 0}
                    delta={overview?.unique_visitors.growth_pct ?? 0}
                    icon="people-outline"
                    color="#06b6d4"
                  />
                  <KpiCard
                    title="Orders"
                    value={overview?.orders.value ?? 0}
                    delta={overview?.orders.growth_pct ?? 0}
                    icon="bag-check-outline"
                    color="#10b981"
                  />
                  <KpiCard
                    title="Sales"
                    value={`₹${(overview?.sales.value ?? 0).toLocaleString('en-IN')}`}
                    delta={overview?.sales.growth_pct ?? 0}
                    icon="cash-outline"
                    color="#f97316"
                  />
                  <KpiCard
                    title="New Customers"
                    value={overview?.new_customers.value ?? 0}
                    delta={overview?.new_customers.growth_pct ?? 0}
                    icon="person-add-outline"
                    color="#8b5cf6"
                  />
                  <KpiCard
                    title="Returning Cust."
                    value={overview?.returning_customers.value ?? 0}
                    delta={overview?.returning_customers.growth_pct ?? 0}
                    icon="repeat-outline"
                    color="#ec4899"
                  />
                </View>
              </View>

              {/* Graceful notice if 0 orders */}
              {(overview?.orders.value ?? 0) === 0 && (
                <View style={styles.lowDataNoticeCard}>
                  <View style={styles.lowDataIconWrap}>
                    <Ionicons name="sparkles" size={20} color="#f97316" />
                  </View>
                  <View style={styles.lowDataTextWrap}>
                    <Text style={styles.lowDataTitle}>No Order ≠ No Customer Interest</Text>
                    <Text style={styles.lowDataDesc}>
                      Customers have viewed your store {overview?.store_views.value ?? 0} times. Check the Products and Demand tabs to see which items customers are interested in.
                    </Text>
                  </View>
                </View>
              )}

              {/* Conversion Funnel */}
              {funnel ? (
                <View style={styles.sectionWrap}>
                  <Text style={styles.sectionHeading}>Customer Conversion Journey</Text>
                  <Text style={styles.sectionSub}>How customers move from store visit to completed purchase</Text>

                  <View style={styles.cardBox}>
                    <View style={styles.funnelStatsRow}>
                      <View style={styles.funnelStatItem}>
                        <Text style={styles.funnelStatVal}>{funnel.store_views}</Text>
                        <Text style={styles.funnelStatLbl}>Store Views</Text>
                      </View>
                      <View style={styles.funnelStatDivider} />
                      <View style={styles.funnelStatItem}>
                        <Text style={styles.funnelStatVal}>{funnel.avg_time_formatted}</Text>
                        <Text style={styles.funnelStatLbl}>Avg Time</Text>
                      </View>
                      <View style={styles.funnelStatDivider} />
                      <View style={styles.funnelStatItem}>
                        <Text style={[styles.funnelStatVal, { color: '#10b981' }]}>
                          {funnel.conversion_rate_pct}%
                        </Text>
                        <Text style={styles.funnelStatLbl}>Conversion</Text>
                      </View>
                    </View>

                    <View style={styles.funnelStagesWrap}>
                      {funnel.steps.map((step, idx) => {
                        const widthPct = Math.max(12, Math.min(100, step.pct_of_total));
                        return (
                          <View key={step.key} style={styles.funnelStepRow}>
                            <View style={styles.funnelStepMeta}>
                              <Text style={styles.funnelStepLabel}>{step.label}</Text>
                              <Text style={styles.funnelStepCount}>
                                {step.count.toLocaleString()}
                                {idx > 0 ? (
                                  <Text style={styles.funnelStepPct}> ({step.pct_of_total}%)</Text>
                                ) : null}
                              </Text>
                            </View>
                            <View style={styles.funnelTrack}>
                              <View
                                style={[
                                  styles.funnelBar,
                                  {
                                    width: `${widthPct}%`,
                                    backgroundColor:
                                      idx === 0
                                        ? '#6366f1'
                                        : idx === 1
                                          ? '#06b6d4'
                                          : idx === 2
                                            ? '#f59e0b'
                                            : '#10b981',
                                  },
                                ]}
                              />
                            </View>
                            {idx < funnel.steps.length - 1 ? (
                              <View style={styles.funnelArrowWrap}>
                                <Ionicons name="arrow-down" size={14} color="#94a3b8" />
                              </View>
                            ) : null}
                          </View>
                        );
                      })}
                    </View>

                    <View style={styles.funnelFactBox}>
                      <Ionicons name="information-circle-outline" size={16} color="#475569" />
                      <Text style={styles.funnelFactText}>{funnel.funnel_note}</Text>
                    </View>
                  </View>
                </View>
              ) : null}

              {/* Sales Trend Chart */}
              {salesOverview ? (
                <View style={styles.sectionWrap}>
                  <Text style={styles.sectionHeading}>Sales Trends</Text>
                  <Text style={styles.sectionSub}>Daily sales and average order value</Text>

                  <View style={styles.cardBox}>
                    <View style={styles.salesOverviewHeader}>
                      <View>
                        <Text style={styles.salesBigNum}>
                          ₹{salesOverview.total_sales.toLocaleString('en-IN')}
                        </Text>
                        <Text style={styles.salesBigSub}>
                          {salesOverview.orders} orders · AOV: ₹{salesOverview.average_order_value}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.trendPill,
                          salesOverview.growth_pct >= 0 ? styles.trendUp : styles.trendDown,
                        ]}
                      >
                        <Text
                          style={[
                            styles.trendText,
                            salesOverview.growth_pct >= 0 ? styles.trendTextUp : styles.trendTextDown,
                          ]}
                        >
                          {salesOverview.growth_pct >= 0
                            ? `+${salesOverview.growth_pct}%`
                            : `${salesOverview.growth_pct}%`}
                        </Text>
                      </View>
                    </View>

                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={styles.dailyChartWrap}>
                        {salesOverview.daily_points.map((point) => {
                          const barH = Math.max(6, Math.min(80, (point.sales / maxDailySales) * 75));
                          return (
                            <View key={point.date} style={styles.dailyCol}>
                              <Text style={styles.dailyValText}>
                                {point.sales > 0 ? `₹${Math.round(point.sales)}` : ''}
                              </Text>
                              <View style={styles.dailyBarTrack}>
                                <View
                                  style={[
                                    styles.dailyBar,
                                    {
                                      height: barH,
                                      backgroundColor: point.sales > 0 ? tokens.colors.vendorPrimary : '#e2e8f0',
                                    },
                                  ]}
                                />
                              </View>
                              <Text style={styles.dailyLabelText}>{point.label}</Text>
                            </View>
                          );
                        })}
                      </View>
                    </ScrollView>
                  </View>
                </View>
              ) : null}

              {/* Hourly Demand Activity */}
              {engagement ? (
                <View style={styles.sectionWrap}>
                  <Text style={styles.sectionHeading}>Peak Hours & Customer Engagement</Text>
                  <Text style={styles.sectionSub}>Viewing time and demand distribution</Text>

                  <View style={styles.cardBox}>
                    <View style={styles.engagePillRow}>
                      <View style={styles.engagePill}>
                        <Ionicons name="time-outline" size={16} color="#6366f1" />
                        <View>
                          <Text style={styles.engagePillVal}>{engagement.avg_store_time_formatted}</Text>
                          <Text style={styles.engagePillLbl}>Average Store Time</Text>
                        </View>
                      </View>
                      <View style={styles.engagePill}>
                        <Ionicons name="flash-outline" size={16} color="#f59e0b" />
                        <View>
                          <Text style={styles.engagePillVal}>{engagement.peak_activity_window}</Text>
                          <Text style={styles.engagePillLbl}>Peak Activity Window</Text>
                        </View>
                      </View>
                    </View>

                    <Text style={styles.chartTitle}>Hourly Demand Distribution</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={styles.hourlyChartWrap}>
                        {engagement.hourly_activity.map((slot) => {
                          const barHeight = Math.max(6, Math.min(90, (slot.orders / maxHourlyOrders) * 85));
                          return (
                            <View key={slot.hour} style={styles.hourlyCol}>
                              <Text style={styles.hourlyValText}>{slot.orders > 0 ? slot.orders : ''}</Text>
                              <View style={styles.hourlyBarTrack}>
                                <View
                                  style={[
                                    styles.hourlyBar,
                                    {
                                      height: barHeight,
                                      backgroundColor: slot.orders > 0 ? tokens.colors.vendorPrimary : '#e2e8f0',
                                    },
                                  ]}
                                />
                              </View>
                              <Text style={styles.hourlyLabelText}>{slot.label.replace(' ', '')}</Text>
                            </View>
                          );
                        })}
                      </View>
                    </ScrollView>
                  </View>
                </View>
              ) : null}
            </>
          )}

          {/* TAB 2: PRODUCTS ("કઈ પ્રોડક્ટ ચાલે છે" & Paginated Performance) */}
          {activeTab === 'products' && (
            <View style={styles.sectionWrap}>
              {/* Product Header & View Mode Switcher */}
              <View style={styles.productTopControls}>
                <View>
                  <Text style={styles.sectionHeading}>Product Performance</Text>
                  <Text style={styles.sectionSub}>Track which products are selling, viewed, or need attention</Text>
                </View>

                {/* View toggle */}
                <View style={styles.viewToggleGroup}>
                  <Pressable
                    style={[styles.viewToggleBtn, productViewMode === 'list' && styles.viewToggleBtnActive]}
                    onPress={() => setProductViewMode('list')}
                  >
                    <Ionicons
                      name="list-outline"
                      size={14}
                      color={productViewMode === 'list' ? '#ffffff' : '#64748b'}
                    />
                    <Text style={[styles.viewToggleText, productViewMode === 'list' && styles.viewToggleTextActive]}>
                      List ({filteredProducts.length})
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.viewToggleBtn, productViewMode === 'matrix' && styles.viewToggleBtnActive]}
                    onPress={() => setProductViewMode('matrix')}
                  >
                    <Ionicons
                      name="grid-outline"
                      size={14}
                      color={productViewMode === 'matrix' ? '#ffffff' : '#64748b'}
                    />
                    <Text style={[styles.viewToggleText, productViewMode === 'matrix' && styles.viewToggleTextActive]}>
                      Matrix
                    </Text>
                  </Pressable>
                </View>
              </View>

              {productViewMode === 'list' ? (
                <>
                  {/* Search Bar */}
                  <View style={styles.searchBarBox}>
                    <Ionicons name="search" size={16} color="#94a3b8" />
                    <TextInput
                      style={styles.searchBarInput}
                      placeholder="Search food, board games, toys, items..."
                      placeholderTextColor="#94a3b8"
                      value={productSearchQuery}
                      onChangeText={setProductSearchQuery}
                      clearButtonMode="while-editing"
                    />
                    {productSearchQuery.length > 0 ? (
                      <Pressable onPress={() => setProductSearchQuery('')}>
                        <Ionicons name="close-circle" size={16} color="#94a3b8" />
                      </Pressable>
                    ) : null}
                  </View>

                  {/* Multi-business Category Filter Chips (Food / Boardgames / Toys) */}
                  {categoryOptions.length > 0 ? (
                    <View style={styles.filterChipScrollWrap}>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipScroll}>
                        <Pressable
                          style={[styles.filterChip, selectedCategoryFilter === 'all' && styles.filterChipActive]}
                          onPress={() => setSelectedCategoryFilter('all')}
                        >
                          <Text style={[styles.filterChipText, selectedCategoryFilter === 'all' && styles.filterChipTextActive]}>
                            All Categories
                          </Text>
                        </Pressable>
                        {categoryOptions.map((catName) => (
                          <Pressable
                            key={catName}
                            style={[styles.filterChip, selectedCategoryFilter === catName && styles.filterChipActive]}
                            onPress={() => setSelectedCategoryFilter(catName)}
                          >
                            <Text style={[styles.filterChipText, selectedCategoryFilter === catName && styles.filterChipTextActive]}>
                              {catName}
                            </Text>
                          </Pressable>
                        ))}
                      </ScrollView>
                    </View>
                  ) : null}

                  {/* Status & Sorting Filter Row */}
                  <View style={styles.statusSortRow}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statusPillsScroll}>
                      <Pressable
                        style={[styles.statusPill, productStatusFilter === 'all' && styles.statusPillActive]}
                        onPress={() => setProductStatusFilter('all')}
                      >
                        <Text style={[styles.statusPillText, productStatusFilter === 'all' && styles.statusPillTextActive]}>
                          All Status
                        </Text>
                      </Pressable>
                      <Pressable
                        style={[styles.statusPill, productStatusFilter === 'selling' && styles.statusPillActive]}
                        onPress={() => setProductStatusFilter('selling')}
                      >
                        <Text style={[styles.statusPillText, productStatusFilter === 'selling' && styles.statusPillTextActive]}>
                          ⭐ Selling Well
                        </Text>
                      </Pressable>
                      <Pressable
                        style={[styles.statusPill, productStatusFilter === 'attention' && styles.statusPillActive]}
                        onPress={() => setProductStatusFilter('attention')}
                      >
                        <Text style={[styles.statusPillText, productStatusFilter === 'attention' && styles.statusPillTextActive]}>
                          ⚠️ High Views, No Orders
                        </Text>
                      </Pressable>
                      <Pressable
                        style={[styles.statusPill, productStatusFilter === 'low' && styles.statusPillActive]}
                        onPress={() => setProductStatusFilter('low')}
                      >
                        <Text style={[styles.statusPillText, productStatusFilter === 'low' && styles.statusPillTextActive]}>
                          💤 Low Activity
                        </Text>
                      </Pressable>
                    </ScrollView>
                  </View>

                  {/* Sorting Buttons */}
                  <View style={styles.sortBar}>
                    <Text style={styles.sortBarLabel}>Sort by:</Text>
                    <Pressable
                      style={[styles.sortBtn, productSortBy === 'orders' && styles.sortBtnActive]}
                      onPress={() => setProductSortBy('orders')}
                    >
                      <Text style={[styles.sortBtnText, productSortBy === 'orders' && styles.sortBtnTextActive]}>
                        Orders
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[styles.sortBtn, productSortBy === 'revenue' && styles.sortBtnActive]}
                      onPress={() => setProductSortBy('revenue')}
                    >
                      <Text style={[styles.sortBtnText, productSortBy === 'revenue' && styles.sortBtnTextActive]}>
                        Revenue
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[styles.sortBtn, productSortBy === 'views' && styles.sortBtnActive]}
                      onPress={() => setProductSortBy('views')}
                    >
                      <Text style={[styles.sortBtnText, productSortBy === 'views' && styles.sortBtnTextActive]}>
                        Views
                      </Text>
                    </Pressable>
                  </View>

                  {/* Paginated Products List */}
                  {paginatedProducts.length > 0 ? (
                    <View style={styles.productListWrap}>
                      {paginatedProducts.map((p, idx) => {
                        const isStar = p.orders >= 5;
                        const isNeedsAttention = p.views >= 4 && p.orders === 0;

                        return (
                          <View key={p.id} style={styles.productCardModern}>
                            {/* Card Top: Rank/Name/Badge */}
                            <View style={styles.prodModernHeader}>
                              <View style={styles.prodModernLeft}>
                                <View style={styles.prodIndexBadge}>
                                  <Text style={styles.prodIndexText}>#{idx + 1}</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                  <Text style={styles.prodModernTitle} numberOfLines={1}>
                                    {p.name}
                                  </Text>
                                  <View style={styles.prodModernMetaRow}>
                                    {p.category_name ? (
                                      <View style={styles.prodCategoryChip}>
                                        <Text style={styles.prodCategoryText}>{p.category_name}</Text>
                                      </View>
                                    ) : null}
                                    <Text style={styles.prodModernPrice}>₹{p.price}</Text>
                                    {!p.is_available ? (
                                      <View style={styles.unavailableChip}>
                                        <Text style={styles.unavailableChipText}>Unavailable</Text>
                                      </View>
                                    ) : null}
                                  </View>
                                </View>
                              </View>

                              {/* Performance Badge */}
                              {isStar ? (
                                <View style={styles.badgeStar}>
                                  <Text style={styles.badgeStarText}>⭐ Star Seller</Text>
                                </View>
                              ) : isNeedsAttention ? (
                                <View style={styles.badgeAttention}>
                                  <Text style={styles.badgeAttentionText}>⚠️ High Views, 0 Orders</Text>
                                </View>
                              ) : p.orders > 0 ? (
                                <View style={styles.badgeActive}>
                                  <Text style={styles.badgeActiveText}>Active</Text>
                                </View>
                              ) : null}
                            </View>

                            {/* Metrics 4-Box Grid */}
                            <View style={styles.prodMetricsGrid}>
                              <View style={styles.prodMetricCol}>
                                <Text style={styles.prodMetricValOrders}>{p.orders}</Text>
                                <Text style={styles.prodMetricLbl}>🛍️ Orders</Text>
                              </View>
                              <View style={styles.prodMetricCol}>
                                <Text style={styles.prodMetricValUnits}>{p.units_sold}</Text>
                                <Text style={styles.prodMetricLbl}>📦 Units</Text>
                              </View>
                              <View style={styles.prodMetricCol}>
                                <Text style={styles.prodMetricValRev}>₹{p.revenue.toLocaleString('en-IN')}</Text>
                                <Text style={styles.prodMetricLbl}>💰 Revenue</Text>
                              </View>
                              <View style={styles.prodMetricCol}>
                                <Text style={styles.prodMetricValViews}>{p.views}</Text>
                                <Text style={styles.prodMetricLbl}>👀 Views ({p.conversion_rate_pct}%)</Text>
                              </View>
                            </View>

                            {/* Insight Note if available */}
                            {p.insight_note ? (
                              <View style={styles.prodInsightBanner}>
                                <Ionicons name="information-circle-outline" size={13} color="#b45309" />
                                <Text style={styles.prodInsightText}>{p.insight_note}</Text>
                              </View>
                            ) : null}
                          </View>
                        );
                      })}

                      {/* Pagination "Load More" to prevent mobile lag */}
                      {visibleProductCount < filteredProducts.length ? (
                        <Pressable
                          style={styles.loadMoreButton}
                          onPress={() => setVisibleProductCount((prev) => prev + PRODUCTS_PAGE_SIZE)}
                        >
                          <Ionicons name="chevron-down-circle-outline" size={18} color={tokens.colors.vendorPrimary} />
                          <Text style={styles.loadMoreText}>
                            Load More Products ({filteredProducts.length - visibleProductCount} remaining)
                          </Text>
                        </Pressable>
                      ) : filteredProducts.length > PRODUCTS_PAGE_SIZE ? (
                        <View style={styles.allLoadedNotice}>
                          <Text style={styles.allLoadedText}>Showing all {filteredProducts.length} products</Text>
                        </View>
                      ) : null}
                    </View>
                  ) : (
                    <View style={styles.emptyProductsCard}>
                      <Ionicons name="file-tray-outline" size={36} color="#94a3b8" />
                      <Text style={styles.emptyProductsTitle}>No products match your criteria</Text>
                      <Text style={styles.emptyProductsSub}>
                        Try clearing search terms or changing category filters.
                      </Text>
                      <Pressable
                        style={styles.clearFiltersBtn}
                        onPress={() => {
                          setProductSearchQuery('');
                          setSelectedCategoryFilter('all');
                          setProductStatusFilter('all');
                        }}
                      >
                        <Text style={styles.clearFiltersBtnText}>Reset Filters</Text>
                      </Pressable>
                    </View>
                  )}
                </>
              ) : (
                /* Matrix Quadrants View */
                matrix ? (
                  <View style={styles.matrixContainer}>
                    <View style={styles.matrixTabsRow}>
                      <Pressable
                        onPress={() => setActiveMatrixTab('star_products')}
                        style={[
                          styles.matrixTab,
                          activeMatrixTab === 'star_products' ? styles.matrixTabActiveGreen : null,
                        ]}
                      >
                        <Text
                          style={[
                            styles.matrixTabText,
                            activeMatrixTab === 'star_products' ? styles.matrixTabTextActive : null,
                          ]}
                        >
                          ⭐ Star Products
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setActiveMatrixTab('needs_attention')}
                        style={[
                          styles.matrixTab,
                          activeMatrixTab === 'needs_attention' ? styles.matrixTabActiveAmber : null,
                        ]}
                      >
                        <Text
                          style={[
                            styles.matrixTabText,
                            activeMatrixTab === 'needs_attention' ? styles.matrixTabTextActive : null,
                          ]}
                        >
                          ⚠️ Needs Attention
                        </Text>
                      </Pressable>
                    </View>
                    <View style={[styles.matrixTabsRow, { marginTop: 6 }]}>
                      <Pressable
                        onPress={() => setActiveMatrixTab('hidden_performers')}
                        style={[
                          styles.matrixTab,
                          activeMatrixTab === 'hidden_performers' ? styles.matrixTabActiveIndigo : null,
                        ]}
                      >
                        <Text
                          style={[
                            styles.matrixTabText,
                            activeMatrixTab === 'hidden_performers' ? styles.matrixTabTextActive : null,
                          ]}
                        >
                          💎 Hidden Performers
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setActiveMatrixTab('low_activity')}
                        style={[
                          styles.matrixTab,
                          activeMatrixTab === 'low_activity' ? styles.matrixTabActiveSlate : null,
                        ]}
                      >
                        <Text
                          style={[
                            styles.matrixTabText,
                            activeMatrixTab === 'low_activity' ? styles.matrixTabTextActive : null,
                          ]}
                        >
                          💤 Low Activity
                        </Text>
                      </Pressable>
                    </View>

                    {/* Active quadrant list */}
                    <View style={styles.matrixCardContent}>
                      <View style={styles.matrixQuadHeader}>
                        <Text style={styles.matrixQuadTitle}>
                          {matrix[activeMatrixTab]?.title}
                        </Text>
                        <Text style={styles.matrixQuadBadge}>
                          {matrix[activeMatrixTab]?.description}
                        </Text>
                      </View>

                      {matrix[activeMatrixTab]?.items?.length > 0 ? (
                        matrix[activeMatrixTab].items.map((item) => (
                          <View key={item.id} style={styles.matrixItemRow}>
                            <View style={styles.matrixItemLeft}>
                              <Text style={styles.matrixItemName}>{item.name}</Text>
                              <Text style={styles.matrixItemStats}>
                                {item.views} views · {item.orders} orders
                              </Text>
                            </View>
                            <Text style={styles.matrixItemRevenue}>
                              ₹{item.revenue.toLocaleString('en-IN')}
                            </Text>
                          </View>
                        ))
                      ) : (
                        <Text style={styles.emptyQuadrantText}>No products currently in this quadrant.</Text>
                      )}
                    </View>
                  </View>
                ) : null
              )}
            </View>
          )}

          {/* TAB 3: CUSTOMER DEMAND & SEARCHES */}
          {activeTab === 'demand' && (
            <>
              {/* Store Closure & Missed Sales Impact */}
              {insights?.store_closure_impact?.has_impact ? (
                <View style={styles.closureImpactCard}>
                  <View style={styles.closureImpactHeader}>
                    <View style={styles.closureImpactIconWrap}>
                      <Ionicons name="time" size={20} color="#dc2626" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.closureImpactHeadline}>
                        {insights.store_closure_impact.headline}
                      </Text>
                      <Text style={styles.closureImpactSub}>
                        Customer demand recorded while store was marked closed
                      </Text>
                    </View>
                  </View>

                  <View style={styles.closureMetricsRow}>
                    <View style={styles.closureMetricCol}>
                      <Text style={styles.closureMetricVal}>
                        {insights.store_closure_impact.missed_visits}
                      </Text>
                      <Text style={styles.closureMetricLbl}>Missed Visits</Text>
                    </View>
                    <View style={styles.closureMetricDivider} />
                    <View style={styles.closureMetricCol}>
                      <Text style={styles.closureMetricVal}>
                        ~{insights.store_closure_impact.missed_orders_estimate}
                      </Text>
                      <Text style={styles.closureMetricLbl}>Est. Orders</Text>
                    </View>
                    <View style={styles.closureMetricDivider} />
                    <View style={styles.closureMetricCol}>
                      <Text style={[styles.closureMetricVal, { color: '#dc2626' }]}>
                        ₹{insights.store_closure_impact.estimated_missed_revenue.toLocaleString('en-IN')}
                      </Text>
                      <Text style={styles.closureMetricLbl}>Est. Lost Sales</Text>
                    </View>
                  </View>

                  <Text style={styles.closureImpactMsg}>
                    {insights.store_closure_impact.message}
                  </Text>
                </View>
              ) : null}

              {/* Missed Demand / Opportunities */}
              {searchAnalytics && searchAnalytics.missed_demand.length > 0 ? (
                <View style={styles.sectionWrap}>
                  <View style={styles.opportunityHeader}>
                    <Ionicons name="bulb-outline" size={20} color="#f97316" />
                    <Text style={styles.opportunityTitle}>High Customer Demand Opportunities</Text>
                  </View>
                  <Text style={styles.sectionSub}>Items customers actively searched for that are missing from your catalog</Text>

                  <View style={styles.missedDemandList}>
                    {searchAnalytics.missed_demand.map((opp) => (
                      <View key={opp.query} style={styles.missedDemandCard}>
                        <View style={styles.missedTopRow}>
                          <View style={styles.missedBadge}>
                            <Text style={styles.missedBadgeText}>Opportunity</Text>
                          </View>
                          <Text style={styles.missedSearchCount}>{opp.searches} searches</Text>
                        </View>

                        <Text style={styles.missedDesc}>{opp.opportunity_text}</Text>

                        <View style={styles.missedActionRow}>
                          <Text style={styles.missedNotice}>High customer interest</Text>
                          {onNavigateToTab ? (
                            <Pressable
                              style={styles.addMenuCta}
                              onPress={() => onNavigateToTab('products')}
                            >
                              <Ionicons name="add" size={16} color="#ffffff" />
                              <Text style={styles.addMenuCtaText}>Add to Catalog</Text>
                            </Pressable>
                          ) : null}
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              {/* What Customers Search For */}
              {searchAnalytics && searchAnalytics.searches.length > 0 ? (
                <View style={styles.sectionWrap}>
                  <Text style={styles.sectionHeading}>What Customers Are Searching For</Text>
                  <Text style={styles.sectionSub}>Actual search queries related to your items</Text>

                  <View style={styles.cardBox}>
                    {searchAnalytics.searches.map((item, idx) => (
                      <View
                        key={item.query + idx}
                        style={[
                          styles.searchQueryRow,
                          idx < searchAnalytics.searches.length - 1 ? styles.rowBorderBottom : null,
                        ]}
                      >
                        <View style={styles.searchRankWrap}>
                          <Text style={styles.searchRankNum}>#{idx + 1}</Text>
                        </View>

                        <View style={styles.searchQueryBody}>
                          <View style={styles.searchQueryTop}>
                            <Text style={styles.searchQueryTitle}>{item.query}</Text>
                            <View style={styles.searchBadgesRow}>
                              {item.is_available ? (
                                <View style={styles.availableBadge}>
                                  <Text style={styles.availableBadgeText}>In Menu</Text>
                                </View>
                              ) : (
                                <View style={styles.unavailableBadge}>
                                  <Text style={styles.unavailableBadgeText}>Unavailable</Text>
                                </View>
                              )}
                              <View
                                style={[
                                  styles.trendPill,
                                  item.trend === 'up'
                                    ? styles.trendUp
                                    : item.trend === 'down'
                                      ? styles.trendDown
                                      : styles.trendStable,
                                ]}
                              >
                                <Ionicons
                                  name={
                                    item.trend === 'up'
                                      ? 'arrow-up'
                                      : item.trend === 'down'
                                        ? 'arrow-down'
                                        : 'remove'
                                  }
                                  size={11}
                                  color={
                                    item.trend === 'up'
                                      ? '#10b981'
                                      : item.trend === 'down'
                                        ? '#ef4444'
                                        : '#64748b'
                                  }
                                />
                                <Text
                                  style={[
                                    styles.trendText,
                                    item.trend === 'up'
                                      ? styles.trendTextUp
                                      : item.trend === 'down'
                                        ? styles.trendTextDown
                                        : styles.trendTextStable,
                                  ]}
                                >
                                  {item.trend_pct}
                                </Text>
                              </View>
                            </View>
                          </View>

                          <View style={styles.searchMetricsChain}>
                            <Text style={styles.chainNode}>
                              <Text style={styles.chainBold}>{item.count}</Text> searches
                            </Text>
                            <Text style={styles.chainSep}>→</Text>
                            <Text style={styles.chainNode}>
                              <Text style={styles.chainBold}>{item.views}</Text> views
                            </Text>
                            <Text style={styles.chainSep}>→</Text>
                            <Text style={styles.chainNode}>
                              <Text style={styles.chainBold}>{item.carts}</Text> carts
                            </Text>
                            <Text style={styles.chainSep}>→</Text>
                            <Text style={[styles.chainNode, { color: '#10b981' }]}>
                              <Text style={styles.chainBold}>{item.orders}</Text> orders
                            </Text>
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              {/* Demand Trends */}
              {insights?.demand_trends &&
              (insights.demand_trends.growing.length > 0 || insights.demand_trends.declining.length > 0) ? (
                <View style={styles.sectionWrap}>
                  <Text style={styles.sectionHeading}>Demand Trends</Text>
                  <Text style={styles.sectionSub}>Items gaining vs losing interest</Text>

                  <View style={styles.cardBox}>
                    {insights.demand_trends.growing.map((item) => (
                      <View key={`grow-${item.id}`} style={styles.trendRow}>
                        <View style={styles.trendIconGrow}>
                          <Ionicons name="trending-up" size={16} color="#10b981" />
                        </View>
                        <View style={styles.trendBody}>
                          <Text style={styles.trendTitle}>{item.name}</Text>
                          <Text style={styles.trendOrdersStat}>+ {item.orders_growth_pct}% order growth</Text>
                        </View>
                        <View style={styles.growingBadge}>
                          <Text style={styles.growingBadgeText}>{item.label}</Text>
                        </View>
                      </View>
                    ))}

                    {insights.demand_trends.declining.map((item) => (
                      <View key={`dec-${item.id}`} style={styles.trendRow}>
                        <View style={styles.trendIconDec}>
                          <Ionicons name="trending-down" size={16} color="#ef4444" />
                        </View>
                        <View style={styles.trendBody}>
                          <Text style={styles.trendTitle}>{item.name}</Text>
                          <Text style={styles.trendOrdersStat}>{item.orders_growth_pct}% vs prior</Text>
                        </View>
                        <View style={styles.decliningBadge}>
                          <Text style={styles.decliningBadgeText}>{item.label}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
            </>
          )}

          {/* TAB 4: GROWTH & BUILDING INSIGHTS */}
          {activeTab === 'growth' && (
            <>
              {/* Customer Retention Split */}
              {customerActivity ? (
                <View style={styles.sectionWrap}>
                  <Text style={styles.sectionHeading}>Customer Retention</Text>
                  <Text style={styles.sectionSub}>New customers vs repeat buyers</Text>

                  <View style={styles.cardBox}>
                    <View style={styles.custActivityStats}>
                      <View style={styles.custStatCol}>
                        <Text style={styles.custStatVal}>{customerActivity.total_visitors}</Text>
                        <Text style={styles.custStatLbl}>Visitors</Text>
                      </View>
                      <View style={styles.custStatDivider} />
                      <View style={styles.custStatCol}>
                        <Text style={[styles.custStatVal, { color: '#f97316' }]}>
                          {customerActivity.new_customers}
                        </Text>
                        <Text style={styles.custStatLbl}>New Customers</Text>
                      </View>
                      <View style={styles.custStatDivider} />
                      <View style={styles.custStatCol}>
                        <Text style={[styles.custStatVal, { color: '#3b82f6' }]}>
                          {customerActivity.returning_customers}
                        </Text>
                        <Text style={styles.custStatLbl}>Returning</Text>
                      </View>
                      <View style={styles.custStatDivider} />
                      <View style={styles.custStatCol}>
                        <Text style={[styles.custStatVal, { color: '#10b981' }]}>
                          {customerActivity.repeat_purchase_rate_pct}%
                        </Text>
                        <Text style={styles.custStatLbl}>Repeat Rate</Text>
                      </View>
                    </View>

                    {customerActivity.total_customers > 0 ? (
                      <View style={styles.custRatioWrap}>
                        <View
                          style={[
                            styles.custRatioBarNew,
                            {
                              flex: Math.max(
                                1,
                                customerActivity.new_customers / customerActivity.total_customers
                              ),
                            },
                          ]}
                        />
                        <View
                          style={[
                            styles.custRatioBarRet,
                            {
                              flex: Math.max(
                                1,
                                customerActivity.returning_customers / customerActivity.total_customers
                              ),
                            },
                          ]}
                        />
                      </View>
                    ) : null}
                  </View>
                </View>
              ) : null}

              {/* Building-wise Analytics */}
              {insights?.building_analytics && insights.building_analytics.length > 0 ? (
                <View style={styles.sectionWrap}>
                  <View style={styles.buildingHeaderWrap}>
                    <Ionicons name="business" size={18} color={tokens.colors.vendorPrimary} />
                    <Text style={styles.sectionHeading}>Building-Wise Performance</Text>
                  </View>
                  <Text style={styles.sectionSub}>Detailed revenue, orders, and visitors for each corporate office building</Text>

                  <View style={styles.buildingListWrap}>
                    {insights.building_analytics.map((bldg) => {
                      const conversionRate = bldg.conversion_rate_pct !== undefined
                        ? bldg.conversion_rate_pct
                        : (bldg.store_views > 0 ? Math.round((bldg.orders / bldg.store_views) * 100 * 10) / 10 : 0);

                      return (
                        <View key={bldg.building_id} style={styles.buildingCard}>
                          <View style={styles.buildingCardTop}>
                            <View style={{ flex: 1, paddingRight: 8 }}>
                              <Text style={styles.buildingCardTitle}>{bldg.name}</Text>
                              {bldg.address ? (
                                <Text style={styles.buildingCardAddress} numberOfLines={1}>
                                  {bldg.address}
                                </Text>
                              ) : null}
                            </View>
                            <View style={styles.buildingSalesBadge}>
                              <Text style={styles.buildingSalesAmount}>
                                ₹{bldg.sales.toLocaleString('en-IN')}
                              </Text>
                              <Text style={styles.buildingSalesSub}>Total Sales</Text>
                            </View>
                          </View>

                          <View style={styles.buildingCardMetricsRow}>
                            <View style={styles.buildingMetricCol}>
                              <Text style={styles.buildingMetricVal}>{bldg.orders}</Text>
                              <Text style={styles.buildingMetricLbl}>Orders</Text>
                            </View>
                            <View style={styles.buildingMetricDivider} />
                            <View style={styles.buildingMetricCol}>
                              <Text style={styles.buildingMetricVal}>{bldg.store_views}</Text>
                              <Text style={styles.buildingMetricLbl}>Visits</Text>
                            </View>
                            <View style={styles.buildingMetricDivider} />
                            <View style={styles.buildingMetricCol}>
                              <Text style={[styles.buildingMetricVal, { color: '#10b981' }]}>
                                {conversionRate}%
                              </Text>
                              <Text style={styles.buildingMetricLbl}>Conversion</Text>
                            </View>
                            <View style={styles.buildingMetricDivider} />
                            <View style={styles.buildingMetricCol}>
                              <Text style={[styles.buildingMetricVal, { color: '#f97316' }]}>
                                {bldg.new_customers}
                              </Text>
                              <Text style={styles.buildingMetricLbl}>New Users</Text>
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              ) : null}

              {/* Building Opportunities */}
              {insights?.building_opportunities && insights.building_opportunities.length > 0 ? (
                <View style={styles.sectionWrap}>
                  <Text style={styles.sectionHeading}>Building Opportunities</Text>
                  <Text style={styles.sectionSub}>High-density buildings where you can grow order volume</Text>

                  <View style={styles.opportunitiesList}>
                    {insights.building_opportunities.map((opp) => (
                      <View key={opp.building_id} style={styles.oppCard}>
                        <View style={styles.oppTop}>
                          <Text style={styles.oppTitle}>{opp.name}</Text>
                          <View style={styles.oppBadge}>
                            <Text style={styles.oppBadgeText}>Growth Potential</Text>
                          </View>
                        </View>

                        <Text style={styles.oppMessage}>{opp.message}</Text>
                        <Text style={styles.oppStats}>
                          {opp.deskdrop_users} DeskDrop users · {opp.store_views} views · {opp.orders} orders
                        </Text>

                        {onNavigateToTab ? (
                          <Pressable
                            style={styles.oppCta}
                            onPress={() => onNavigateToTab('products')}
                          >
                            <Ionicons name="megaphone-outline" size={15} color={tokens.colors.vendorPrimary} />
                            <Text style={styles.oppCtaText}>View Products</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              {/* Action Recommendations */}
              {insights?.recommendations && insights.recommendations.length > 0 ? (
                <View style={styles.sectionWrap}>
                  <Text style={styles.sectionHeading}>Recommended Actions</Text>
                  <Text style={styles.sectionSub}>Suggestions based on recent customer search and ordering patterns</Text>

                  <View style={styles.recommendationsList}>
                    {insights.recommendations.map((rec) => (
                      <View key={rec.key} style={styles.recommendationCard}>
                        <View style={styles.recTopRow}>
                          <Text style={styles.recTitle}>{rec.title}</Text>
                          {onNavigateToTab ? (
                            <Pressable
                              style={styles.recCtaButton}
                              onPress={() => onNavigateToTab(rec.action_tab as VendorTabKey)}
                            >
                              <Text style={styles.recCtaText}>{rec.action_label}</Text>
                              <Ionicons name="arrow-forward" size={12} color="#ffffff" />
                            </Pressable>
                          ) : null}
                        </View>
                        <Text style={styles.recDesc}>{rec.description}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
            </>
          )}
        </ScrollView>
      )}

      {/* Custom Date Range Picker Modal */}
      <Modal
        visible={isCustomDateModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsCustomDateModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Custom Date Range</Text>
                <Text style={styles.modalSub}>Filter analytics by specific start and end dates</Text>
              </View>
              <Pressable onPress={() => setIsCustomDateModalOpen(false)} hitSlop={10}>
                <Ionicons name="close-circle" size={26} color="#94a3b8" />
              </Pressable>
            </View>

            <View style={styles.customDateInputsWrap}>
              <View style={styles.customDateInputGroup}>
                <Text style={styles.customDateLabel}>Start Date (YYYY-MM-DD):</Text>
                <TextInput
                  style={styles.customDateTextInput}
                  placeholder="2026-09-01"
                  placeholderTextColor="#94a3b8"
                  value={customStartDate}
                  onChangeText={setCustomStartDate}
                />
              </View>

              <View style={styles.customDateInputGroup}>
                <Text style={styles.customDateLabel}>End Date (YYYY-MM-DD):</Text>
                <TextInput
                  style={styles.customDateTextInput}
                  placeholder="2026-10-08"
                  placeholderTextColor="#94a3b8"
                  value={customEndDate}
                  onChangeText={setCustomEndDate}
                />
              </View>

              <View style={styles.quickPresetButtonsRow}>
                <Pressable
                  style={styles.quickPresetBtn}
                  onPress={() => {
                    const today = new Date();
                    const d14 = new Date(today);
                    d14.setDate(d14.getDate() - 14);
                    setCustomStartDate(d14.toISOString().split('T')[0]);
                    setCustomEndDate(today.toISOString().split('T')[0]);
                  }}
                >
                  <Text style={styles.quickPresetText}>Last 14 Days</Text>
                </Pressable>
                <Pressable
                  style={styles.quickPresetBtn}
                  onPress={() => {
                    const today = new Date();
                    const d60 = new Date(today);
                    d60.setDate(d60.getDate() - 60);
                    setCustomStartDate(d60.toISOString().split('T')[0]);
                    setCustomEndDate(today.toISOString().split('T')[0]);
                  }}
                >
                  <Text style={styles.quickPresetText}>Last 60 Days</Text>
                </Pressable>
              </View>

              <Pressable style={styles.applyCustomDateBtn} onPress={handleApplyCustomDates}>
                <Ionicons name="checkmark-circle-outline" size={18} color="#ffffff" />
                <Text style={styles.applyCustomDateBtnText}>Apply Custom Range</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Weekly Report Modal */}
      <Modal
        visible={weeklyModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setWeeklyModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Weekly Business Report</Text>
                <Text style={styles.modalSub}>Performance summary for this week</Text>
              </View>
              <Pressable onPress={() => setWeeklyModalVisible(false)} hitSlop={10}>
                <Ionicons name="close-circle" size={26} color="#94a3b8" />
              </Pressable>
            </View>

            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {weeklyReport ? (
                <>
                  <View style={styles.weeklyKpiRow}>
                    <View style={styles.weeklyKpiCard}>
                      <Text style={styles.weeklyKpiVal}>{weeklyReport.total_orders}</Text>
                      <Text style={styles.weeklyKpiLbl}>Total Orders</Text>
                    </View>
                    <View style={styles.weeklyKpiCard}>
                      <Text style={[styles.weeklyKpiVal, { color: tokens.colors.vendorPrimary }]}>
                        ₹{weeklyReport.total_sales.toLocaleString('en-IN')}
                      </Text>
                      <Text style={styles.weeklyKpiLbl}>Total Sales</Text>
                    </View>
                  </View>

                  <View style={styles.weeklyKpiRow}>
                    <View style={styles.weeklyKpiCard}>
                      <Text style={styles.weeklyKpiVal}>{weeklyReport.new_customers}</Text>
                      <Text style={styles.weeklyKpiLbl}>New Customers</Text>
                    </View>
                    <View style={styles.weeklyKpiCard}>
                      <Text style={styles.weeklyKpiVal}>{weeklyReport.store_views}</Text>
                      <Text style={styles.weeklyKpiLbl}>Store Views</Text>
                    </View>
                  </View>

                  <View style={styles.weeklyDetailsCard}>
                    <View style={styles.weeklyDetailRow}>
                      <Text style={styles.weeklyDetailLbl}>Top Product</Text>
                      <Text style={styles.weeklyDetailVal}>{weeklyReport.top_product}</Text>
                    </View>
                    <View style={styles.weeklyDetailRow}>
                      <Text style={styles.weeklyDetailLbl}>Most Searched</Text>
                      <Text style={styles.weeklyDetailVal}>{weeklyReport.most_searched_product}</Text>
                    </View>
                    <View style={styles.weeklyDetailRow}>
                      <Text style={styles.weeklyDetailLbl}>Best Building</Text>
                      <Text style={styles.weeklyDetailVal}>{weeklyReport.best_building}</Text>
                    </View>
                    <View style={styles.weeklyDetailRow}>
                      <Text style={styles.weeklyDetailLbl}>Peak Order Time</Text>
                      <Text style={styles.weeklyDetailVal}>{weeklyReport.peak_order_time}</Text>
                    </View>
                    <View style={styles.weeklyDetailRow}>
                      <Text style={styles.weeklyDetailLbl}>Conversion Rate</Text>
                      <Text style={[styles.weeklyDetailVal, { color: '#10b981' }]}>
                        {weeklyReport.conversion_rate_pct}%
                      </Text>
                    </View>
                  </View>

                  {weeklyReport.key_insights?.length > 0 ? (
                    <View style={styles.weeklySection}>
                      <Text style={styles.weeklySectionTitle}>Key Highlights</Text>
                      {weeklyReport.key_insights.map((ins, i) => (
                        <View key={i} style={styles.weeklyInsightItem}>
                          <Text style={styles.weeklyInsightIcon}>{ins.icon}</Text>
                          <Text style={styles.weeklyInsightText}>{ins.description}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </>
              ) : (
                <ActivityIndicator size="small" color={tokens.colors.vendorPrimary} />
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// KPI Card Subcomponent
function KpiCard({
  title,
  value,
  delta,
  icon,
  color,
}: {
  title: string;
  value: number | string;
  delta: number;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}) {
  const isPositive = delta > 0;
  const isZero = delta === 0;

  return (
    <View style={styles.kpiCard}>
      <View style={styles.kpiTopRow}>
        <View style={[styles.kpiIconWrap, { backgroundColor: `${color}15` }]}>
          <Ionicons name={icon} size={18} color={color} />
        </View>
        <View
          style={[
            styles.deltaBadge,
            isPositive ? styles.deltaPositive : isZero ? styles.deltaZero : styles.deltaNegative,
          ]}
        >
          <Ionicons
            name={isPositive ? 'arrow-up' : isZero ? 'remove' : 'arrow-down'}
            size={10}
            color={isPositive ? '#10b981' : isZero ? '#64748b' : '#ef4444'}
          />
          <Text
            style={[
              styles.deltaText,
              { color: isPositive ? '#10b981' : isZero ? '#64748b' : '#ef4444' },
            ]}
          >
            {isPositive ? `+${delta}%` : `${delta}%`}
          </Text>
        </View>
      </View>

      <Text numberOfLines={1} style={styles.kpiValue}>
        {value}
      </Text>
      <Text numberOfLines={1} style={styles.kpiTitle}>
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  weeklyReportBadgeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    gap: 4,
    borderWidth: 1,
    borderColor: '#ffedd5',
  },
  weeklyReportBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: tokens.colors.vendorPrimary,
  },
  dateFilterContainer: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  dateFilterContent: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 8,
  },
  datePill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
  },
  datePillActive: {
    backgroundColor: tokens.colors.vendorPrimary,
  },
  datePillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  datePillTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  segmentNavBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingHorizontal: 8,
  },
  segmentNavBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 11,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  segmentNavBtnActive: {
    borderBottomColor: tokens.colors.vendorPrimary,
  },
  segmentNavText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  segmentNavTextActive: {
    color: tokens.colors.vendorPrimary,
    fontWeight: '800',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 20,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
  },
  errorWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  errorText: {
    fontSize: 14,
    color: '#ef4444',
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: tokens.colors.vendorPrimary,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  todayCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  todayHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  todayLiveWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#10b981',
  },
  todayLiveText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: 0.5,
  },
  todayUpdatedText: {
    fontSize: 11,
    color: '#94a3b8',
  },
  todayStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  todayStatCol: {
    alignItems: 'center',
    flex: 1,
  },
  todayStatVal: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  todayStatLbl: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
  sectionWrap: {
    gap: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  sectionSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: -2,
    marginBottom: 4,
  },
  comparisonBadge: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  kpiCard: {
    width: '48.5%',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  kpiTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  kpiIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deltaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    gap: 2,
  },
  deltaPositive: {
    backgroundColor: '#ecfdf5',
  },
  deltaNegative: {
    backgroundColor: '#fef2f2',
  },
  deltaZero: {
    backgroundColor: '#f1f5f9',
  },
  deltaText: {
    fontSize: 10,
    fontWeight: '700',
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
  },
  kpiTitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '600',
  },
  lowDataNoticeCard: {
    flexDirection: 'row',
    backgroundColor: '#fff7ed',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fed7aa',
    gap: 10,
    alignItems: 'flex-start',
  },
  lowDataIconWrap: {
    marginTop: 2,
  },
  lowDataTextWrap: {
    flex: 1,
  },
  lowDataTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#9a3412',
  },
  lowDataDesc: {
    fontSize: 11,
    color: '#c2410c',
    marginTop: 2,
    lineHeight: 16,
  },
  cardBox: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  funnelStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    marginBottom: 14,
  },
  funnelStatItem: {
    alignItems: 'center',
  },
  funnelStatVal: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  funnelStatLbl: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
  funnelStatDivider: {
    width: 1,
    height: '80%',
    backgroundColor: '#e2e8f0',
    alignSelf: 'center',
  },
  funnelStagesWrap: {
    gap: 8,
  },
  funnelStepRow: {
    gap: 4,
  },
  funnelStepMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  funnelStepLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e293b',
  },
  funnelStepCount: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
  },
  funnelStepPct: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  funnelTrack: {
    height: 10,
    backgroundColor: '#f1f5f9',
    borderRadius: 6,
    overflow: 'hidden',
  },
  funnelBar: {
    height: '100%',
    borderRadius: 6,
  },
  funnelArrowWrap: {
    alignItems: 'center',
    marginVertical: -2,
  },
  funnelFactBox: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 10,
    gap: 8,
    marginTop: 12,
    alignItems: 'center',
  },
  funnelFactText: {
    fontSize: 11,
    color: '#475569',
    flex: 1,
    lineHeight: 15,
  },
  salesOverviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  salesBigNum: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0f172a',
  },
  salesBigSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  dailyChartWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 120,
    paddingTop: 10,
    gap: 12,
  },
  dailyCol: {
    alignItems: 'center',
    width: 44,
    gap: 4,
  },
  dailyValText: {
    fontSize: 9,
    fontWeight: '700',
    color: tokens.colors.vendorPrimary,
    height: 14,
  },
  dailyBarTrack: {
    height: 80,
    width: 14,
    backgroundColor: '#f1f5f9',
    borderRadius: 6,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  dailyBar: {
    width: '100%',
    borderRadius: 6,
  },
  dailyLabelText: {
    fontSize: 9,
    color: '#64748b',
    fontWeight: '600',
  },
  engagePillRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  engagePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 10,
    gap: 8,
  },
  engagePillVal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  engagePillLbl: {
    fontSize: 10,
    color: '#64748b',
  },
  chartTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
    marginBottom: 8,
  },
  hourlyChartWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 120,
    paddingTop: 10,
    gap: 12,
  },
  hourlyCol: {
    alignItems: 'center',
    width: 32,
    gap: 4,
  },
  hourlyValText: {
    fontSize: 10,
    fontWeight: '700',
    color: tokens.colors.vendorPrimary,
    height: 14,
  },
  hourlyBarTrack: {
    height: 85,
    width: 12,
    backgroundColor: '#f1f5f9',
    borderRadius: 6,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  hourlyBar: {
    width: '100%',
    borderRadius: 6,
  },
  hourlyLabelText: {
    fontSize: 9,
    color: '#64748b',
    fontWeight: '600',
  },

  /* Product Tab Modern Styles */
  productTopControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  viewToggleGroup: {
    flexDirection: 'row',
    backgroundColor: '#e2e8f0',
    borderRadius: 8,
    padding: 2,
  },
  viewToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  viewToggleBtnActive: {
    backgroundColor: tokens.colors.vendorPrimary,
  },
  viewToggleText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  viewToggleTextActive: {
    color: '#ffffff',
  },
  searchBarBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchBarInput: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a',
    padding: 0,
  },
  filterChipScrollWrap: {
    marginVertical: 4,
  },
  filterChipScroll: {
    gap: 6,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterChipActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#3b82f6',
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  filterChipTextActive: {
    color: '#2563eb',
    fontWeight: '800',
  },
  statusSortRow: {
    marginTop: 2,
  },
  statusPillsScroll: {
    gap: 6,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statusPillActive: {
    backgroundColor: '#f0fdf4',
    borderColor: '#10b981',
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  statusPillTextActive: {
    color: '#15803d',
    fontWeight: '800',
  },
  sortBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    marginBottom: 4,
  },
  sortBarLabel: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '700',
  },
  sortBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
  },
  sortBtnActive: {
    backgroundColor: '#e0e7ff',
  },
  sortBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  sortBtnTextActive: {
    color: '#4338ca',
    fontWeight: '800',
  },
  productListWrap: {
    gap: 10,
    marginTop: 6,
  },
  productCardModern: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  prodModernHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  prodModernLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    flex: 1,
  },
  prodIndexBadge: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  prodIndexText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
  },
  prodModernTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  prodModernMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
  },
  prodCategoryChip: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  prodCategoryText: {
    fontSize: 10,
    color: '#475569',
    fontWeight: '700',
  },
  prodModernPrice: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0f172a',
  },
  unavailableChip: {
    backgroundColor: '#fef2f2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  unavailableChipText: {
    fontSize: 10,
    color: '#ef4444',
    fontWeight: '700',
  },
  badgeStar: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeStarText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#b45309',
  },
  badgeAttention: {
    backgroundColor: '#fff7ed',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeAttentionText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#c2410c',
  },
  badgeActive: {
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeActiveText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#15803d',
  },
  prodMetricsGrid: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 8,
    justifyContent: 'space-between',
  },
  prodMetricCol: {
    alignItems: 'center',
    flex: 1,
  },
  prodMetricValOrders: {
    fontSize: 14,
    fontWeight: '900',
    color: '#10b981',
  },
  prodMetricValUnits: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0f172a',
  },
  prodMetricValRev: {
    fontSize: 13,
    fontWeight: '900',
    color: tokens.colors.vendorPrimary,
  },
  prodMetricValViews: {
    fontSize: 13,
    fontWeight: '900',
    color: '#6366f1',
  },
  prodMetricLbl: {
    fontSize: 9,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '700',
  },
  prodInsightBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fefce8',
    padding: 6,
    borderRadius: 6,
  },
  prodInsightText: {
    fontSize: 11,
    color: '#92400e',
    fontWeight: '600',
    flex: 1,
  },
  loadMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: tokens.colors.vendorPrimary,
    borderRadius: 10,
    paddingVertical: 12,
    gap: 8,
    marginTop: 6,
  },
  loadMoreText: {
    fontSize: 13,
    fontWeight: '800',
    color: tokens.colors.vendorPrimary,
  },
  allLoadedNotice: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  allLoadedText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  emptyProductsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 8,
    marginTop: 8,
  },
  emptyProductsTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#334155',
  },
  emptyProductsSub: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
  },
  clearFiltersBtn: {
    backgroundColor: tokens.colors.vendorPrimary,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 6,
    marginTop: 4,
  },
  clearFiltersBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },

  /* Matrix Styles */
  matrixContainer: {
    marginTop: 4,
  },
  matrixTabsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  matrixTab: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  matrixTabActiveGreen: {
    backgroundColor: '#10b981',
  },
  matrixTabActiveAmber: {
    backgroundColor: '#f59e0b',
  },
  matrixTabActiveIndigo: {
    backgroundColor: '#6366f1',
  },
  matrixTabActiveSlate: {
    backgroundColor: '#64748b',
  },
  matrixTabText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  matrixTabTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  matrixCardContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 8,
    gap: 10,
  },
  matrixQuadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 8,
  },
  matrixQuadTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  matrixQuadBadge: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  matrixItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  matrixItemLeft: {
    gap: 2,
  },
  matrixItemName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  matrixItemStats: {
    fontSize: 11,
    color: '#64748b',
  },
  matrixItemRevenue: {
    fontSize: 13,
    fontWeight: '800',
    color: tokens.colors.vendorPrimary,
  },
  emptyQuadrantText: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    paddingVertical: 12,
  },

  /* Search & Missed Demand Styles */
  opportunityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  opportunityTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#c2410c',
  },
  missedDemandList: {
    gap: 10,
  },
  missedDemandCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#fed7aa',
    gap: 6,
  },
  missedTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  missedBadge: {
    backgroundColor: '#fff7ed',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  missedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#c2410c',
  },
  missedSearchCount: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0f172a',
  },
  missedDesc: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 17,
  },
  missedActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  missedNotice: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '600',
  },
  addMenuCta: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.vendorPrimary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    gap: 4,
  },
  addMenuCtaText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ffffff',
  },
  searchQueryRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    gap: 10,
  },
  rowBorderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  searchRankWrap: {
    width: 28,
    alignItems: 'center',
    paddingTop: 2,
  },
  searchRankNum: {
    fontSize: 12,
    fontWeight: '800',
    color: '#94a3b8',
  },
  searchQueryBody: {
    flex: 1,
    gap: 4,
  },
  searchQueryTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  searchQueryTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  searchBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  availableBadge: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  availableBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#10b981',
  },
  unavailableBadge: {
    backgroundColor: '#fef2f2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  unavailableBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ef4444',
  },
  trendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    gap: 2,
  },
  trendUp: {
    backgroundColor: '#ecfdf5',
  },
  trendDown: {
    backgroundColor: '#fef2f2',
  },
  trendStable: {
    backgroundColor: '#f1f5f9',
  },
  trendText: {
    fontSize: 10,
    fontWeight: '700',
  },
  trendTextUp: {
    color: '#10b981',
  },
  trendTextDown: {
    color: '#ef4444',
  },
  trendTextStable: {
    color: '#64748b',
  },
  searchMetricsChain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  chainNode: {
    fontSize: 11,
    color: '#64748b',
  },
  chainBold: {
    fontWeight: '800',
    color: '#0f172a',
  },
  chainSep: {
    fontSize: 10,
    color: '#cbd5e1',
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 10,
  },
  trendIconGrow: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trendIconDec: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#fef2f2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trendBody: {
    flex: 1,
    gap: 2,
  },
  trendTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  trendOrdersStat: {
    fontSize: 11,
    color: '#64748b',
  },
  growingBadge: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  growingBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#10b981',
  },
  decliningBadge: {
    backgroundColor: '#fef2f2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  decliningBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#ef4444',
  },

  /* Growth / Customer retention Styles */
  custActivityStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 14,
  },
  custStatCol: {
    alignItems: 'center',
    flex: 1,
  },
  custStatVal: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
  },
  custStatLbl: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
    textAlign: 'center',
  },
  custStatDivider: {
    width: 1,
    height: '80%',
    backgroundColor: '#e2e8f0',
    alignSelf: 'center',
  },
  custRatioWrap: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 6,
  },
  custRatioBarNew: {
    backgroundColor: '#f97316',
  },
  custRatioBarRet: {
    backgroundColor: '#3b82f6',
  },
  buildingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 10,
  },
  buildingIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buildingBody: {
    flex: 1,
    gap: 2,
  },
  buildingName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  buildingAddress: {
    fontSize: 11,
    color: '#94a3b8',
  },
  buildingMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  buildingMetricItem: {
    fontSize: 10,
    color: '#64748b',
  },
  bBold: {
    fontWeight: '800',
    color: '#0f172a',
  },
  productStatDot: {
    fontSize: 10,
    color: '#cbd5e1',
  },
  buildingSalesCol: {
    alignItems: 'flex-end',
  },
  buildingSalesVal: {
    fontSize: 13,
    fontWeight: '800',
    color: tokens.colors.vendorPrimary,
  },
  opportunitiesList: {
    gap: 10,
  },
  oppCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 6,
  },
  oppTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  oppTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  oppBadge: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  oppBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#10b981',
  },
  oppMessage: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  oppStats: {
    fontSize: 11,
    color: '#94a3b8',
  },
  oppCta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#fff7ed',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
    marginTop: 4,
  },
  oppCtaText: {
    fontSize: 12,
    fontWeight: '800',
    color: tokens.colors.vendorPrimary,
  },
  recommendationsList: {
    gap: 10,
  },
  recommendationCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 6,
  },
  recTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    flex: 1,
  },
  recCtaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.vendorPrimary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    gap: 2,
  },
  recCtaText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ffffff',
  },
  recDesc: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 17,
  },

  /* Modals */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
  },
  modalSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  modalScroll: {
    marginBottom: 20,
  },
  weeklyKpiRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  weeklyKpiCard: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  weeklyKpiVal: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
  },
  weeklyKpiLbl: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  weeklyDetailsCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 14,
    gap: 10,
    marginVertical: 10,
  },
  weeklyDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  weeklyDetailLbl: {
    fontSize: 12,
    color: '#64748b',
  },
  weeklyDetailVal: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
  },
  weeklySection: {
    marginTop: 10,
    gap: 8,
  },
  weeklySectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  weeklyInsightItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff7ed',
    padding: 10,
    borderRadius: 10,
  },
  weeklyInsightIcon: {
    fontSize: 16,
  },
  weeklyInsightText: {
    fontSize: 12,
    color: '#9a3412',
    fontWeight: '600',
    flex: 1,
  },

  /* Custom Date Modal Specific */
  customDateInputsWrap: {
    gap: 14,
    paddingBottom: 20,
  },
  customDateInputGroup: {
    gap: 6,
  },
  customDateLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  customDateTextInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
  },
  quickPresetButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  quickPresetBtn: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  quickPresetText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  applyCustomDateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.vendorPrimary,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
    marginTop: 10,
  },
  applyCustomDateBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  // Building-Wise Styles
  buildingHeaderWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  buildingListWrap: {
    gap: 12,
    marginTop: 10,
  },
  buildingCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  buildingCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  buildingCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 3,
  },
  buildingCardAddress: {
    fontSize: 12,
    color: '#64748b',
  },
  buildingSalesBadge: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'flex-end',
  },
  buildingSalesAmount: {
    fontSize: 15,
    fontWeight: '800',
    color: '#16a34a',
  },
  buildingSalesSub: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803d',
    textTransform: 'uppercase',
  },
  buildingCardMetricsRow: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  buildingMetricCol: {
    flex: 1,
    alignItems: 'center',
  },
  buildingMetricVal: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1e293b',
  },
  buildingMetricLbl: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    marginTop: 2,
    textTransform: 'uppercase',
  },
  buildingMetricDivider: {
    width: 1,
    height: 22,
    backgroundColor: '#e2e8f0',
  },
  // Store Closure Impact Styles
  closureImpactCard: {
    backgroundColor: '#fff1f2',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#fecdd3',
  },
  closureImpactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  closureImpactIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#ffe4e6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closureImpactHeadline: {
    fontSize: 15,
    fontWeight: '800',
    color: '#9f1239',
  },
  closureImpactSub: {
    fontSize: 12,
    color: '#be123c',
    marginTop: 2,
  },
  closureMetricsRow: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'space-around',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#fecdd3',
  },
  closureMetricCol: {
    flex: 1,
    alignItems: 'center',
  },
  closureMetricVal: {
    fontSize: 15,
    fontWeight: '800',
    color: '#881337',
  },
  closureMetricLbl: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9f1239',
    marginTop: 2,
    textTransform: 'uppercase',
  },
  closureMetricDivider: {
    width: 1,
    height: 22,
    backgroundColor: '#fecdd3',
  },
  closureImpactMsg: {
    fontSize: 12,
    lineHeight: 17,
    color: '#9f1239',
  },
});
